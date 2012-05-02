define('templates', function() {
	var templates = {};
	templates.domLoaded = function() {
		[].forEach.call(document
			.querySelectorAll('script[type="text/x-template"]'), function(el) {
				templates[el.id] = el.innerHTML;
			});
		delete templates.domLoaded;
	};

	return templates;
});
