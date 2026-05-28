import { analyze } from '@glyph/index.js';
import { GLYPH_PUBLIC_PACKS } from './glyph-knowledge-packs.js';
import { splitArtists } from './artists.js';
import { findDuplicateGroups, mergeDuplicateGroups } from './glyph-duplicates.js';
import { trackWithInferredAlbum } from './glyph-album.js';
import { loadFingerprintsForTracks, findSpectralDuplicateGroups } from './glyph-spectral.js';
import { evaluateSuggestion } from '@glyph/core/suggestion-confidence.js';

const UNKNOWN_ARTIST = 'Unknown Artist';
const UNKNOWN_ALBUM = 'Unknown Album';

function needsAttention(tr) {
  if (!String(tr.title || '').trim()) return true;
  const names = splitArtists(tr.artist);
  if (!names.length || names.every((a) => a === UNKNOWN_ARTIST)) return true;
  if (!tr.album || tr.album === UNKNOWN_ALBUM) return true;
  return false;
}

function trackInput(tr, allTracks) {
  const siblings = allTracks.filter(
    (t) => t.id !== tr.id && t.album === tr.album && t.artist === tr.artist
  );
  return {
    filePath: tr.path,
    tags: tr,
    context: { siblingTracks: siblings, folderHint: tr.album || '' },
  };
}

/** Library scan for Music Vault — runs in Senza, no Python required. */
export async function scanVaultLibrary(tracks, state, { maxFixPreview = 12, api = null } = {}) {
  const total = tracks.length;
  if (!total) {
    return {
      total: 0,
      score: 0,
      tagPct: 0,
      coverPct: 0,
      needsAttention: 0,
      glyphCanHelp: 0,
      insights: [],
      fixPreviews: [],
      duplicateGroups: [],
      duplicateTrackCount: 0,
      provider: 'glyph-mi',
    };
  }

  const enrichedTracks = tracks.map((tr) => trackWithInferredAlbum(tr, tracks));
  let dupResult = findDuplicateGroups(enrichedTracks);

  if (api?.glyphFingerprint && tracks.length <= 800) {
    const fpLimit = Math.min(100, tracks.length);
    const fpMap = await loadFingerprintsForTracks(tracks, api, { limit: fpLimit });
    if (fpMap.size >= 2) {
      const spectral = findSpectralDuplicateGroups(tracks, fpMap);
      if (spectral.length) dupResult = mergeDuplicateGroups(dupResult, spectral);
    }
  }

  const { groups: duplicateGroups, duplicateTrackCount, groupCount } = dupResult;
  const attention = enrichedTracks.filter(needsAttention);
  const withCover = tracks.filter((t) => t.hasCover).length;
  const withTags = tracks.filter(
    (t) => t.title && t.artist && t.artist !== UNKNOWN_ARTIST
  ).length;

  const tagPct = Math.round((withTags / total) * 100);
  const coverPct = Math.round((withCover / total) * 100);
  const score = Math.min(
    100,
    Math.round(tagPct * 0.5 + coverPct * 0.3 + (100 - (attention.length / total) * 100) * 0.2)
  );

  const fixPreviews = [];
  let glyphCanHelp = 0;

  for (const tr of attention) {
    if (fixPreviews.length >= maxFixPreview * 2) break;
    try {
      const result = await analyze(trackInput(tr, enrichedTracks), {
        provider: 'mi',
        knowledgePacks: GLYPH_PUBLIC_PACKS,
      });
      const fields = result.fields || {};
      const applyConf = evaluateSuggestion(tr, fields, {
        score: result.confidence?.score,
        reasons: result.confidence?.reasons,
        sources: result.sources,
      });
      if (!applyConf.noop && applyConf.score >= 48 && fields.title) {
        glyphCanHelp += 1;
        if (fixPreviews.length < maxFixPreview) {
          const name = (tr.path || '').split(/[/\\]/).pop() || '—';
          fixPreviews.push({
            trackId: tr.id,
            basename: name,
            before: { title: tr.title, artist: tr.artist, album: tr.album },
            suggested: fields,
            confidence: applyConf,
          });
        }
      }
    } catch {
      /* skip track */
    }
  }

  const insights = [];
  if (attention.length) {
    insights.push({
      key: 'attention',
      severity: 'warn',
      vars: { n: attention.length },
    });
  }
  if (glyphCanHelp) {
    insights.push({
      key: 'glyph_fix',
      severity: 'info',
      vars: { n: glyphCanHelp },
    });
  }
  if (groupCount) {
    insights.push({
      key: 'duplicates',
      severity: 'warn',
      vars: { groups: groupCount, files: duplicateTrackCount },
    });
  }

  const artistSet = new Set();
  for (const t of tracks) {
    for (const a of splitArtists(t.artist)) {
      if (a && a !== UNKNOWN_ARTIST) artistSet.add(a);
    }
  }

  return {
    total,
    artists: artistSet.size,
    albums: new Set(tracks.map((t) => `${t.artist}::${t.album}`)).size,
    score,
    tagPct,
    coverPct,
    needsAttention: attention.length,
    missingCovers: total - withCover,
    glyphCanHelp,
    insights,
    fixPreviews,
    duplicateGroups,
    duplicateTrackCount,
    duplicateGroupCount: groupCount,
    provider: 'glyph-mi',
  };
}
