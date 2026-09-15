// 알람 창 전용 다리.
//
// 이 창은 본체와 따로 도는 작은 창이라, 고른 것(다시 울리기 · 해제)을
// 본체에 알릴 길이 필요하다. 알릴 것은 그것 하나뿐이므로 그것만 연다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nekoAlarm', {
  /** @param action 'snooze' | 'off'  @param min 다시 울리기까지의 분 */
  done: (action, min) => ipcRenderer.send('alarm-done', { action, min: Number(min) || 0 }),
});
