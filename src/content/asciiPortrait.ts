/**
 * The portrait, carried over verbatim from the previous site
 * (frontend/src/common/components/AsciiArt.tsx).
 *
 * It is the one piece of the old Next.js build worth keeping: a hand-made
 * block-character self-portrait. There it was rasterised char-by-char onto a
 * 2D canvas by a particle system; here it is baked once into a cell mask and
 * drawn by <AsciiPortrait /> in a single shader, so the same picture costs one
 * draw call inside the 3D world.
 *
 * DO NOT reformat: every space is significant, and the grid dimensions below
 * are derived from the string rather than typed twice.
 */
export const ASCII_PORTRAIT = `
                 █████████████████████████████████████               
             ██████          ███████████████████████                 
           ████████                 █████████████ ███                
            █████████                             ███                
            ███████████                            ██                
            █████████                              ██                
            ████████    █████                       █                
             ██████   ███████████               ████                 
             █████             ████       ██████████                 
             ██████████████████████████ █████████████████            
         ████ ████  ██  ███    █    ██████             ██            
        █    ████   ██    ████      ██  ██ ████ ███    █             
        █ ██   ███   ██   ███       █    ██████       ██             
        █   ██ ███   ██            ██     █           ██             
        █    █  ██    ███        ███      ██         ██              
         █   █  ██       ████████          ██████████                
         ██   █ ███                  █████           █               
           ██   ████             ███████████        ██               
              ███████        ██████████████████     █                
                 █████    █████████       ███████  ██                
                 ███████ ████    ██████████   ███████                
                 ████████████                  ██████                
                  ████████████     ███████    ██████                 
                   █████████████            ████████                 
                    ████████████████     ██████████                  
                     ██████████████████████████████                  
                       ██████████████████████████                    
               ██         ██████████████████████                     
           ███████           █████████████████                       
        ███████  ████               ████                             
     █████    ███  ████                    ███                       
 █████          ███   ████                 ███████                   
 ██               ███    ██████          ███  ██ ████                
                    ███      ██████████████   ██    █████            
                       ████                 ███         █████        
                          █████          ████              █████     
                               ███████████                    █████  
                                                                  ███
`;

/** Non-empty rows, all padded to the same width. Parsed once at module load. */
export const PORTRAIT_ROWS: string[] = (() => {
  const lines = ASCII_PORTRAIT.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const w = lines.reduce((n, l) => Math.max(n, l.length), 0);
  return lines.map((l) => l.padEnd(w, ' '));
})();

export const PORTRAIT_COLS = PORTRAIT_ROWS[0].length;
export const PORTRAIT_ROW_COUNT = PORTRAIT_ROWS.length;

/**
 * Width / height of the portrait when each cell is drawn at a monospace
 * character's proportions (advance ≈ 0.6 of the line height). Use this to size
 * the quad, or the face comes out stretched.
 */
export const PORTRAIT_ASPECT = (PORTRAIT_COLS * 0.6) / PORTRAIT_ROW_COUNT;
