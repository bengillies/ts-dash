define('utils', ['store'], function(store) {
	var makeAsync = function(fn) {
		window.setTimeout(fn, 0);
	};

	return {
		makeAsync: makeAsync,
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
