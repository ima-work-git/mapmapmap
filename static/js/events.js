/**
 * SSE Event Handler - Real-time events from command system
 */
window.EventBus = (function() {
  const listeners = {};
  let eventSource = null;

  function init() {
    eventSource = new EventSource('/api/events');

    eventSource.addEventListener('call_started', function(e) {
      const data = JSON.parse(e.data);
      emit('call_started', data);
    });

    eventSource.addEventListener('gps_received', function(e) {
      const data = JSON.parse(e.data);
      emit('gps_received', data);
    });

    eventSource.addEventListener('address_searched', function(e) {
      const data = JSON.parse(e.data);
      emit('address_searched', data);
    });

    eventSource.addEventListener('address_confirmed', function(e) {
      const data = JSON.parse(e.data);
      emit('address_confirmed', data);
    });

    eventSource.addEventListener('call_ended', function(e) {
      const data = JSON.parse(e.data);
      emit('call_ended', data);
    });

    eventSource.onerror = function() {
      console.warn('SSE connection lost, reconnecting...');
    };
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => {
      try { cb(data); } catch(e) { console.error('Event handler error:', e); }
    });
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);

  return { on, off, emit };
})();
