const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const url = "https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip";
const destDir = "C:\\Users\\lenovo\\AppData\\Local\\Programs\\Python\\Python312";
const zipPath = path.join(destDir, "embed.zip");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Downloading ${url}...`);
const file = fs.createWriteStream(zipPath);

https.get(url, (response) => {
  if (response.statusCode === 301 || response.statusCode === 302) {
    console.log(`Redirecting to ${response.headers.location}...`);
    https.get(response.headers.location, (res2) => {
      res2.pipe(file);
      file.on('finish', onDownloadComplete);
    }).on('error', (err) => console.error("Error on redirect:", err));
    return;
  }
  response.pipe(file);
  file.on('finish', onDownloadComplete);
}).on('error', (err) => {
  console.error("Download error:", err);
});

function onDownloadComplete() {
  file.close(() => {
    console.log(`Download finished! File size: ${fs.statSync(zipPath).size} bytes`);
    console.log("Extracting embed.zip...");
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
      fs.unlinkSync(zipPath);
      console.log("Extraction complete!");

      // Update python312._pth to enable site-packages
      const pthFile = path.join(destDir, "python312._pth");
      if (fs.existsSync(pthFile)) {
        let pthContent = fs.readFileSync(pthFile, 'utf8');
        pthContent = pthContent.replace("#import site", "import site");
        if (!pthContent.includes("Lib\\site-packages")) {
          pthContent += "\nLib\nLib\\site-packages\n..\n.\n";
        }
        fs.writeFileSync(pthFile, pthContent);
        console.log("Updated python312._pth for site-packages support!");
      }

      // Test python.exe
      const pyExe = path.join(destDir, "python.exe");
      const out = execSync(`"${pyExe}" --version`, { encoding: 'utf8' });
      console.log(`Python test result: ${out.trim()}`);
    } catch (err) {
      console.error("Extraction error:", err);
    }
  });
}
