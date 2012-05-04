define('edit', ['pub', 'templates', 'utils', 'render', 'store'],
function(pub, templates, utils, renderer, store) {
	var Edit = new Exemplar({
		constructor: function(title) {
			var self = this;
			this.title = title || 'New Tiddler';
			this.createForm(function() {
				Emitter.call(self, self.events);
				self.show();
			});
		},
		events: {
			'cancel.click': 'hide',
			'form.submit': 'save',
			'form.keyup': 'cacheChanges',
			'fields.click': 'toggleFields',
			'fields.click [type="button"]': 'newField'
		},
		show: function() {
			var article = document.querySelector('article');
			article.innerHTML = '';
			article.appendChild(this.form);
			this.form.querySelector('input[name="title"]').focus();
		},
		createForm: function(callback) {
			var self = this,
				article = document.querySelector('article');
			store.get(this.title, function(tiddler) {
				var key,
					newFields = [],
					fields = tiddler && tiddler.fields || {};
				self.isNew = !tiddler;
				if (self.isNew) {
					tiddler = new tiddlyweb.Tiddler(self.title);
					tiddler.bag = store.getDefaults().pushTo;
				}
				self.tiddler = extend(new tiddlyweb.Tiddler, tiddler);
				// prepare the tiddler for passing into mustache
				tiddler['public'] = (/_public$/.test(tiddler.bag.name)) ?
					true : false;
				for (key in fields) if (fields.hasOwnProperty(key)) {
					newFields.push({
						key: key,
						value: fields[key]
					});
				}
				tiddler.fields = newFields;
				tiddler.fields.push({
					key: 'server.content-type',
					value: tiddler.type
				});
				renderer.render('mustache', article, templates['tiddlerEdit'],
					tiddler, function(el) {
						self.form = el.querySelector('form');
						self.cancel = el
							.querySelector('.buttons input[type="button"]');
						self.fields = el.querySelector('fieldset');
						callback();
					});
			});
		},
		figureTags: function(tagString) {
			var brackets = /^\s*\[\[([^\]\]]+)\]\](\s*.*)/,
				whitespace = /^\s*([^\s]+)(\s*.*)/,
				match, rest = tagString, tags = [];

			match = brackets.exec(rest) || whitespace.exec(rest);
			while (match) {
				tags.push(match[1]);
				rest = match[2];
				match = brackets.exec(rest) || whitespace.exec(rest);
			}

			return tags;
		},
		gatherFields: function() {
			var el = this.form;
			var tiddler = new tiddlyweb.Tiddler({
					title: el.querySelector('input[name="title"]').value,
					text: el.querySelector('textarea[name="text"]').value,
					tags: this.figureTags(el.querySelector('input[name="tags"]')
						.value),
					fields: {}
				}), i, l, field, value,
				fieldList = el.querySelectorAll('fieldset input');

			for(i = 0, l = fieldList.length; i < l; i++) {
				field = fieldList[i];
				if (field.className === 'key' && field.value) {
					value = fieldList[++i];
					if (value.value) {
						tiddler.fields[field.value] = value.value;
					}
				}
			}

			if (tiddler.fields['server.content-type']) {
				tiddler.type = tiddler.fields['server.content-type'];
			}
			tiddler.bag = extend(new tiddlyweb.Bag, store.getDefaults().pushTo);
			tiddler['public'] = !el.querySelector('input[name="private"]')
				.checked;

			tiddler.bag.name = tiddler.bag.name.replace(/_[^_]+$/,
				(tiddler['public']) ? '_public' : '_private');

			return tiddler;
		},
		hide: function(ev) {
			ev.preventDefault();
			store.remove(this.tiddler);
			if (this.isNew) {
				pub.trigger('load-default');
			} else {
				renderer.render('view-tiddler', this.title);
			}
		},
		save: function(ev) {
			var tiddler = this.gatherFields(),
				self = this;
			store.save(tiddler, function(t) {
				if (t) {
					// remove the old tiddler
					if (t.title !== self.title ||
							t.bag.name !== self.tiddler.bag.name) {
						store.destroy(self.tiddler, function(t) {
							if (!t) {
								alert('There was a problem moving' + t.title +
									'.');
							}
						});

						window.history.pushState(undefined, t.title, t.title);
						renderer.render('view-tiddler', t.title);
					}

					renderer.render('view-tiddler', t.title);
				} else {
					alert('There was a problem saving ' + tiddler.title + '.');
				}
			});
			ev.preventDefault();
		},
		cacheChanges: function(ev) {
			var tiddler;
			if (ev.target.name !== 'title') {
				tiddler = this.gatherFields();
				store.add(tiddler);
			}
		},
		toggleFields: function(ev) {
			ev.stopPropagation();
			if (ev.target.nodeName === 'LEGEND') {
				this.fields.className = (this.fields.className === 'hidden') ?
					'visible' : 'hidden';
			} else {
				this.fields.className = 'visible';
			}
		},
		newField: function(ev) {
			var list = this.fields.querySelector('dl');
			ev.stopPropagation();
			list.innerHTML += ['<dt><input type="text" class="key"></dt>',
				'<dd><input type="text" class="value"></dd>'].join('\n');
			list = list.querySelectorAll('.key');
			list[list.length - 1].focus();
		}
	});

	return Edit;
});
