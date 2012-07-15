define('render', ['pub', 'utils', 'templates', 'store'],
function(pub, utils, templates, store) {
	var curry = utils.curry;

	var renderer = new Emitter({
		mustache: function(el, template, obj, fn) {
			if (el && template) {
				el.innerHTML = Mustache.to_html(template, obj);
				if (typeof fn ===  'function') {
					fn(el);
				}
			}
		},
		'tiddler-text': function(title, fn) {
			var el = document.createElement('div'),
				self = this;
				render = curry.call(this, this.trigger, 'mustache', el);

			store.get(title, function(tiddler, err, xhr) {
				if (!tiddler) {
					if (xhr && ~[404].indexOf(xhr.status)) {
						pub.trigger('edit', title);
					}
					return;
				}
				tiddler.timeago = $.timeago(tiddler.modified);
				if (/^image\//.test(tiddler.type)) {
					pub.trigger('search.toggle', 'show', function() {
						render(templates['tiddlerImage'], tiddler, fn);
					});
				} else if (tiddler.type === 'text/html') {
					pub.trigger('search.toggle', 'hide', function() {
						render(templates['tiddlerHTML'], tiddler, fn);
					});
				} else if (tiddler.render) {
					pub.trigger('search.toggle', 'show', function() {
						render(templates['tiddlerText'], tiddler, fn);
					});
				} else {
					pub.trigger('search.toggle', 'show', function() {
						render(templates['tiddlerCode'], tiddler, fn);
					});
				}

				self.trigger('mustache', document.getElementById('tags'),
					templates['tiddlerTags'], tiddler);
			}, true);
		},
		'view-tiddler': function(title) {
			var self = this;
			document.querySelector('article,#article').innerHTML = '';
			this.trigger('tiddler-text', title, function(text) {
				var el = document.querySelector('article,#article');
				text = text.innerHTML;

				self.trigger('mustache', el, templates['viewTiddler'],
					{ text: text });

				el.setAttribute('data-tiddler', title);
				document.title = title;
			});
		}
	});

	return {
		render: curry.call(renderer, renderer.trigger),
		register: curry.call(renderer, renderer.on)
	};

});
