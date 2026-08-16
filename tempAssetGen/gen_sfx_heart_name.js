const fs = require('fs');
const path = require('path');

const ENGINE = '/Users/blakedellefave/.codex/plugins/cache/ls-extensions/ls-clad/local/skills/build-sfx/tools';
const audio = require(ENGINE);
const PROJECT_ASSETS_SFX = '/Users/blakedellefave/Documents/P.S. Demo 1/Assets/GeneratedSFX';

fs.mkdirSync(PROJECT_ASSETS_SFX, {recursive: true});

const focus = audio.sfx_presets.uiHover({pitch: 2});
audio.mix_bus.masterChain(focus, {normalize: 'peak'});
audio.WavBuilder.write(focus, path.join(PROJECT_ASSETS_SFX, 'NameFieldFocus.wav'));

const accepted = audio.sfx_presets.uiSuccess();
audio.mix_bus.masterChain(accepted, {normalize: 'peak'});
audio.WavBuilder.write(accepted, path.join(PROJECT_ASSETS_SFX, 'NameAccepted.wav'));

