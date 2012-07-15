define('utils', ['store'], function(store) {
	var makeAsync = ('postMessage' in window) ? function(fn) {
		var secret = Math.random(),
			origin = window.location.origin ||
				window.location.protocol + '//' + window.location.host ||
				'*';
        function _callback(ev) {
            if (ev.data === secret) {
                window.removeEventListener('message', _callback);
                fn();
            }
        }
        window.addEventListener('message', _callback);
        window.postMessage(secret, origin);
	} : function(fn) {
		window.setTimeout(fn, 0);
	};

	return {
		makeAsync: makeAsync,
		click: ('ontouchstart' in document.documentElement) ? 'touchstart' :
			'click',
		newTabClick: function(ev) {
			return ev.altKey || ev.metaKey || ev.ctrlKey || ev.shiftKey ||
				ev.keyCode;
		},
		curry: function(fn) {
			var curriedArgs = Array.prototype.slice.call(arguments, 1),
				self = this;
			return function() {
				var args = [].concat(curriedArgs);
				Array.prototype.push.apply(args, arguments);
				fn.apply(self, args);
			}
		},
		makeFat: (function() {
			var isFat = false;
			return function(callback) {
				if (!isFat) {
					$.ajaxSetup({ data: { fat: 1 } });
					store.refresh(function() {
						isFat = true;
						callback.apply(this, arguments);
					});
					$.ajaxSetup({ data: {} });
				} else {
					makeAsync(callback);
				}
			}
		}())
	};
});
