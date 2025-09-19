const fs = require('fs');
const path = require('path');

const ignoreDirs = ['node_modules', '.next', '.git'];

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        fileList = walkDir(filePath, fileList);
      }
    } else {
      fileList.push(path.relative(process.cwd(), filePath));
    }
  });

  return fileList;
}

const fileList = walkDir(process.cwd());
fs.writeFileSync('fileList.txt', fileList.join('\n'), 'utf-8');

console.log('Archivo fileList.txt generado con éxito.');

