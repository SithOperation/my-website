# Sentinel Source Viewer

## Purpose and boundaries

The Source Viewer supplements the Sentinel map; the map remains the primary
interface. The viewer displays validated `source_feed.json` records as
text-first cards. It does not load embeds, remote thumbnails, external media,
or third-party scripts. Opening a card never contacts its publisher. External
contact occurs only after a user activates an HTTPS `Open original source`
link.

Live discovery is an independent ingestion concern. X, Reddit, and ordinary
website adapters may report blocked or unavailable without making the map
unavailable. The interface must not claim that those adapters are operational
when their published health says otherwise.

## Presentation and accessibility

- Desktop uses a right-side, non-modal dock and leaves the map visible.
- Viewport widths of 820 pixels or less use a full-screen modal sheet.
- The mobile sheet makes background regions inert, traps focus, supports
  Escape, and restores focus to the invoking control.
- The desktop dock does not trap focus and does not use `aria-modal`.
- Previous and next controls retain the selected card. Status and Locate
  results are announced through live regions.
- Reduced-motion preferences disable animated Locate movement. Highlighting
  uses a stable outline rather than flashing.

## Association and map behavior

Feed inclusion and map inclusion remain separate. Feed-only records stay in
the complete chronological feed.

An item can expose `Locate on map` only when the validated publication supplies
an eligible association and `event_id`, and that ID exists in the currently
rendered map source. The browser does not infer associations, invent
coordinates, or convert feed items into map features.

Locate uses feature state on the existing `sentinel-events` MapLibre source.
It clears the previous outline, moves to the published event coordinates, and
applies a temporary non-color-only outline. Closing the viewer, moving to an
unrelated card, or returning to the complete feed clears the outline.

An event with associated reports offers `View associated sources`. This opens
the viewer on that event's subset; `Return to complete feed` restores normal
chronological navigation.

Published map events whose metadata says `source_reported` or `unverified`
receive a distinct halo and an explicit detail label. This styling does not
change their claim status or imply verification.

## Availability and failure handling

The viewer supports:

- `loading`
- `available`
- `empty`
- `partial`
- `stale`
- `unavailable`
- `invalid`

An empty unavailable feed is a normal degraded state and does not imply that
the map failed. Mixed publication IDs, unsupported schemas, invalid counts,
unsafe URLs, or malformed records cause the feed to be withheld. The last
validated map remains operational.

## Operational verification

Before release:

1. Validate the release manifest, publication ID, SHA-256, and byte size.
2. Confirm `map_events.json` and `timeline.json` remain bare arrays.
3. Run Python, JavaScript, backend, association, accessibility, security, and
   browser suites.
4. Stage the Pages artifact and run the production gate.
5. Verify the production publication and global map after deployment.

If synchronization or verification fails, do not combine artifacts from
different publications. Preserve the currently deployed release and correct
the incoming release or pipeline before retrying. Source-adapter failures
remain isolated and may publish an empty `unavailable` feed.
