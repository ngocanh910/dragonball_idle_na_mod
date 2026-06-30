// ============================================================
// Android Native Config Endpoints
// These mimic the real game server's config endpoints.
// ============================================================

const config = require('../config');

function register(app) {
  // Main server config — tells the game which server to connect to
  app.get('/lzceshi/native_setting/Android/setting_Android.bin', (_req, res) => {
    console.log('[Config] GET setting_Android.bin');
    res.json({
      sdkName: '',
      versionCode: 110,
      noticeList: [],
      maintain: { status: false },
      serverList: [
        {
          sid: 'local',
          name: config.serverName,
          url: `http://127.0.0.1:${config.port}`,
          dungeonurl: `http://127.0.0.1:${config.port}`,
          chaturl: `http://127.0.0.1:${config.port}`,
          status: 'smooth',
          new: true,
          recommend: true,
          serverId: config.defaultServerId,
          offlineReason: '',
          online: true,
        },
      ],
      maxVersionCode: 110,
      minVersionCode: 1,
      updateUrl: '',
      forceUpdate: false,
      review: false,
    });
  });

  // SDK config
  app.get('/lzceshi/native_setting/Android/com.guan.wangys.bin', (_req, res) => {
    console.log('[Config] GET com.guan.wangys.bin');
    res.json({ version: 1, sdkConfig: {} });
  });

  // Login check (called by native Android before loading the game)
  app.all('/lzceshi/native_setting/Android/loginchecknative', (req, res) => {
    const params = req.query;
    console.log('[Auth]  loginchecknative params:', JSON.stringify(params).substring(0, 200));

    res.json({
      code: 0,
      msg: 'success',
      loginServer: `http://127.0.0.1:${config.port}`,
      serverUrl: `http://127.0.0.1:${config.port}`,
      socketUrl: `http://127.0.0.1:${config.port}`,
      teamServerHttpUrl: `http://127.0.0.1:${config.port}`,
    });
  });
}

module.exports = { register };
