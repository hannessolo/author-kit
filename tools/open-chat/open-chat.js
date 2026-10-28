const button = document.querySelector('#open-chat');
const status = document.querySelector('#status');
const branch = new URLSearchParams(window.location.search).get('nx');
function getSdkOrigin() {
  if (branch === 'local') return 'http://localhost:6456';
  return branch ? `https://${branch}--da-nx--adobe.aem.live` : 'https://da.live';
}

async function init() {
  try {
    if (window.parent === window) throw new Error('Open this app inside the DA fullscreen shell.');
    const { default: sdk } = await import(`${getSdkOrigin()}/nx/utils/sdk.js`);
    const { actions, capabilities } = await sdk;
    if (typeof actions.setPrompt !== 'function') {
      throw new Error('This DA SDK does not support setPrompt.');
    }
    button.addEventListener('click', () => {
      actions.setPrompt('', { autoSend: false });
    });
    button.disabled = false;
    if (capabilities?.chatTurnCompleted === 1
      && typeof actions.subscribeChatTurnCompleted === 'function') {
      let turns = 0;
      const unsubscribe = actions.subscribeChatTurnCompleted(({ status: turnStatus }) => {
        turns += 1;
        status.textContent = `Chat turn ${turns}: ${turnStatus} (${new Date().toLocaleTimeString()})`;
      });
      window.addEventListener('pagehide', unsubscribe, { once: true });
      status.textContent = 'Waiting for a chat turn to finish.';
    } else {
      status.textContent = 'This host does not support chat turn notifications.';
    }
  } catch (error) {
    status.textContent = error.message;
    // eslint-disable-next-line no-console
    console.error('Could not initialize the openChat app:', error);
  }
}

init();
