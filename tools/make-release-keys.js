/* 生成 release keystore + keystore.properties（密码随机，本地保存） */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ANDROID = 'F:\\MyAi\\Trace\\android_app';
const pass = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 16);
const dname = 'CN=Trace, OU=Dev, O=Trace, L=Beijing, ST=Beijing, C=CN';

/* JBR keytool */
const keytool = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe';
const ks = path.join(ANDROID, 'release.keystore');
if (!fs.existsSync(ks)) {
  execSync(`"${keytool}" -genkeypair -v -keystore "${ks}" -alias trace -keyalg RSA -keysize 2048 -validity 10000 -storepass ${pass} -keypass ${pass} -dname "${dname}"`, { stdio: 'pipe' });
  console.log('keystore generated:', ks);
} else {
  console.log('keystore exists, skip');
}
/* keystore.properties（本地，不提交） */
const props = `storeFile=release.keystore\nstorePassword=${pass}\nkeyAlias=trace\nkeyPassword=${pass}\n`;
fs.writeFileSync(path.join(ANDROID, 'keystore.properties'), props, 'utf8');
console.log('keystore.properties written');
/* 密码记录到 TOOLS.md（工作区本地文件，不进 git） */
let tools = fs.readFileSync('TOOLS.md', 'utf8');
if (!tools.includes('release.keystore')) {
  tools += `\n## Android 签名（release）\n- keystore: F:\\MyAi\\Trace\\android_app\\release.keystore（alias: trace）\n- 密码: ${pass}（keystore.properties 同目录）\n- 构建: cd android_app && JAVA_HOME="C:\\Program Files\\Android\\Android Studio\\jbr" gradle assembleRelease\n`;
  fs.writeFileSync('TOOLS.md', tools, 'utf8');
  console.log('TOOLS.md updated');
}
/* .gitignore 加 keystore */
let gi = fs.readFileSync('.gitignore', 'utf8');
if (!gi.includes('*.keystore')) {
  gi += '\n# 签名与密钥（勿提交）\n*.keystore\nkeystore.properties\n';
  fs.writeFileSync('.gitignore', gi, 'utf8');
  console.log('.gitignore updated');
}
