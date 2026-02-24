# Storyline video controls lock via JavaScript

This repository contains a JavaScript solution for controlling video interaction in Articulate Storyline 360. The script allows Storyline developers to programmatically block or allow video seeking and playback speed changes using Storyline variables.

## Purpose

Articulate Storyline does not provide a built-in mechanism to dynamically control video seeking or playback speed based on runtime logic. This script enables reliable control over video interaction by directly interfacing with the HTML5 video element in the published Storyline output.

This approach avoids workarounds such as overlays, timeline-based assumptions, or custom video players.

## How it works

The script reads two Storyline variables:

- `videoObjectId` (Text)  
  The object ID of the Storyline video.

- `videoLocked` (True/False)  
  - `true` → disables seeking and playback speed control  
  - `false` → restores normal video controls  

When locked, the script:

- prevents seeking forward and backward  
- disables interaction with the seekbar  
- hides playback speed controls  
- monitors the DOM to remain effective even when Storyline rebuilds the player  

When unlocked, all restrictions are removed.

## Repository contents

- `/storyline` – example Storyline project file (.story)
- `/javascript` – JavaScript implementation
- Articulate Review link – see below

## Articulate Review

[View the published project](PASTE_REVIEW_LINK_HERE)

## Requirements

- Articulate Storyline 360
- Published HTML5 output
- JavaScript trigger: "Execute JavaScript"

## Implementation summary

1. Create Storyline variables:
   - `videoObjectId` (Text)
   - `videoLocked` (True/False)

2. Add the JavaScript trigger to the slide or layer.

3. Control video interaction by setting `videoLocked` accordingly.

## Notes

This script relies on the HTML structure of Storyline’s published output. Future Storyline updates may require adjustments.

## Background

Additional context and implementation rationale are available here:  
LINK_TO_LINKEDIN_POST
