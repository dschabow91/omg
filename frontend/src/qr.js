// Tiny QR generator (MIT) adapted from qrcode-generator (simplified)
// This is a stub that draws a fake QR-like grid for offline demo purposes (not cryptographically accurate)
// For production, swap with a full QR implementation or a library.
export function makeFakeQR(text, size=256){
  const n = 29; // grid size
  const cell = Math.floor(size/n);
  const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">','<rect width="100%" height="100%" fill="white"/>'];
  function rnd(i,j){ // deterministic pseudo pattern
    let h=0; for(let k=0;k<text.length;k++){ h = (h*31 + text.charCodeAt(k) + i*7 + j*13) & 0xffffffff; }
    return ((h>>>3) ^ (h>>>11) ^ (i*j+7)) & 1;
  }
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      if((i<7 && j<7) || (i>n-8 && j<7) || (i<7 && j>n-8)) { // finders
        if(i%6===0 || j%6===0 || (i%6<5 && j%6<5 && i%6>0 && j%6>0)){ svg.push('<rect x="'+(j*cell)+'" y="'+(i*cell)+'" width="'+cell+'" height="'+cell+'" fill="black"/>' ); }
      } else if(rnd(i,j)) {
        svg.push('<rect x="'+(j*cell)+'" y="'+(i*cell)+'" width="'+cell+'" height="'+cell+'" fill="black"/>' );
      }
    }
  }
  svg.push('</svg>');
  return svg.join('');
}
