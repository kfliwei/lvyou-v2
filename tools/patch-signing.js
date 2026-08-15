/* build.gradle 加 release 签名配置（从 keystore.properties 读取，该文件不提交 git） */
const fs = require('fs');
let s = fs.readFileSync('android_app/app/build.gradle', 'utf8');
const from = `android {
    namespace 'com.gujian.guditu'
    compileSdk 34

    defaultConfig {
        applicationId 'com.gujian.guditu'
        minSdk 26
        targetSdk 34
        versionCode 9
        versionName '2.0'
    }

    buildTypes {
        release {
            minifyEnabled false
        }
        debug {
            minifyEnabled false
        }
    }`;
const to = `def keystoreProps = new Properties()
def keystoreFile = rootProject.file('keystore.properties')
if (keystoreFile.exists()) {
    keystoreProps.load(new FileInputStream(keystoreFile))
}

android {
    namespace 'com.gujian.guditu'
    compileSdk 34

    defaultConfig {
        applicationId 'com.gujian.guditu'
        minSdk 26
        targetSdk 34
        versionCode 10
        versionName '2.0'
    }

    signingConfigs {
        release {
            storeFile rootProject.file(keystoreProps.getProperty('storeFile', 'release.keystore'))
            storePassword keystoreProps.getProperty('storePassword', '')
            keyAlias keystoreProps.getProperty('keyAlias', 'trace')
            keyPassword keystoreProps.getProperty('keyPassword', '')
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.release
        }
        debug {
            minifyEnabled false
        }
    }`;
if (s.includes(from)) {
  s = s.split(from).join(to);
  fs.writeFileSync('android_app/app/build.gradle', s, 'utf8');
  console.log('signing config added (versionCode 10)');
} else {
  console.log('pattern not found');
}
