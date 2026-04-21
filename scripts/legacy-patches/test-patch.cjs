const fs = require('fs');
let content = fs.readFileSync('src/components/Timeline.tsx', 'utf-8');

const svgFunc = `
function getWaveSVG(wave: string) {
  switch (wave) {
    case 'sine': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 Q25,0 50,50 T100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'square': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L0,20 L50,20 L50,80 L100,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'sawtooth': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,80 L100,20 L100,80" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'triangle': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L25,20 L75,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'organ': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 Q10,20 25,50 T50,50 Q60,80 75,50 T100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    case 'brass': return '<svg preserveAspectRatio="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M0,50 L20,30 L40,70 L60,20 L80,80 L100,50" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/></svg>';
    default: return '';
  }
}
`;

if (!content.includes('function getWaveSVG')) {
  content = content.replace('export function Timeline({', svgFunc + '\nexport function Timeline({');
}

fs.writeFileSync('src/components/Timeline.tsx', content);
