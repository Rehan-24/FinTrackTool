// Generate PNG icons from SVG
// Run: node generate-icons.js
// Requires: npm install sharp

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    const svgPath = path.join(__dirname, 'public', 'icon.svg');
    const svgBuffer = fs.readFileSync(svgPath);
    
    console.log('Generating app icons...');
    
    // Generate 192x192 icon
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(__dirname, 'public', 'icon-192.png'));
    console.log('✓ Generated icon-192.png');
    
    // Generate 512x512 icon
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(__dirname, 'public', 'icon-512.png'));
    console.log('✓ Generated icon-512.png');
    
    // Generate Apple touch icon (180x180)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(__dirname, 'public', 'apple-touch-icon.png'));
    console.log('✓ Generated apple-touch-icon.png');
    
    console.log('\n✨ All icons generated successfully!');
    console.log('📱 Deploy and test on your mobile device.');
  } catch (error) {
    console.error('Error generating icons:', error);
    console.log('\nIf sharp is not installed, run: npm install sharp');
  }
}

generateIcons();
