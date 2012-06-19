
define('pub',[], function() {
	return new Emitter();
});

define('templates',[], function() {
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

define('store',[], function() {
	return tiddlyweb.Store();
});

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
			document.querySelector('article').innerHTML = '';
			this.trigger('tiddler-text', title, function(text) {
				var el = document.querySelector('article');
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

define('search', ['pub', 'utils', 'templates', 'store', 'render'],
function(pub, utils, templates, store, renderer) {

	var makeAsync = utils.makeAsync,
		makeFat = utils.makeFat,
		newTabClick = utils.newTabClick,
		searchTimer,
		curry = utils.curry;

	var Search = new Exemplar({
		constructor: function(el) {
			this.el = el;
			this.form = el.querySelector('form');
			this.list = el.querySelector('ul');
			this.searchBox = this.form.querySelector('input[type="search"]');
			Emitter.call(this, this.events);
		},
		events: {
			'toggle': 'toggle',
			'search': 'search',
			'refresh': 'refresh',
			// DOM Events:
			'list.click a': 'openTiddler',
			'searchBox.keyup': function(ev) {
				var self = this;
				if (searchTimer) window.clearTimeout(searchTimer);
				searchTimer = window.setTimeout(function() {
					self.refresh(store(), 'skinny');
					searchTimer = undefined;
				}, 500);
			},
			'form.submit': function(ev) {
				ev.preventDefault();
				this.refresh(store());
			},
			'form.click [type="radio"],label': function(ev) {
				this.refresh(store());
			},
			'list.click button,i': function(ev) {
				var button = ev.target.nodeName === 'BUTTON' ? ev.target :
					ev.target.parentNode,
					eventName = button.className,
					listEl = button.parentNode.nodeName === 'LI' ?
						button.parentNode : button.parentNode.parentNode,
					link = listEl.querySelector('a').title;
				pub.trigger(eventName, link, listEl);
			},
			'form.click button,i': function(ev) {
				pub.trigger('star', this.getSearchString());
			}
		},
		toggle: function(action, callback) {
			// action should be "show" or "hide"
			var animate = false;
			[this.form, this.list].forEach(function(el) {
				if (el.className !== action) {
					el.className = action;
					animate = true;
				}
			});
			if (animate) {
				setTimeout(callback, 1000); // XXX: hacky
			} else {
				makeAsync(callback);
			}
		},
		search: function(searchString) {
			this.searchBox.value = searchString;
			this.refresh(store());
		},
		getSearchString: function() {
			return this.searchBox.value;
		},
		refresh: function(tiddlers, skinny) {
			var render = curry.call(renderer, renderer.render, 'mustache'),
				el = this.list,
				self = this,
				search = this.getSearchString(),
				bindFn = function(t, s) { self.loadUpdatedTiddler(t, s); };

			if (search) {
				try {
					// has a filter string been passed in?
					render(el, templates['tiddlerList'], {
						tiddlers: this.processTiddlers(tiddlers.find(search))
							.sort('-modified')
					});
				} catch(e) {
					if (!skinny) {
						// XXX: switch to using tiddlyweb search instead
						makeFat(function() {
							render(el, templates['tiddlerList'], {
								tiddlers: self._search(store())
							});
						});
					} else {
						render(el, templates['tiddlerList'], {
							tiddlers: this._search(tiddlers)
						});
					}
				}
			} else {
				store.unbind('tiddler');
				store.bind('tiddler', null, bindFn);
				render(el, templates['tiddlerList'], {
					tiddlers: this.processTiddlers(tiddlers).sort('-modified')
				});
			}
		},
		processTiddlers: function(tiddlers) {
			var filter = this.form.querySelector('input[type="radio"]:checked')
				.value;
			switch (filter) {
				case 'Private':
					tiddlers = tiddlers.filter(function(tiddler) {
						return /_private$/.test(tiddler.bag.name);
					});
					// follow through...
				case 'Default':
					tiddlers = tiddlers.space().find('!#excludeLists');
			}
			return tiddlers.map(this.addInfo);
		},
		addInfo: function(tiddler) {
			var space = tiddler.bag.name.split('_'),
				currentSpace = store.recipe.name.split('_'),
				spaceMatch = space[0] === currentSpace[0];
			tiddler.icon = spaceMatch ?
				'/bags/tiddlyspace/tiddlers/' + space[1] + 'Icon' :
				'http://' + space[0] + '.tiddlyspace.com/SiteIcon';
			tiddler.space = spaceMatch ? space[1] : space[0];
			return tiddler;
		},
		_search: function(tiddlers) {
			// give each tiddler a score based on how good the match is, then
			// sort them all based on that match
			var countHash = {},
			search = this.getSearchString();

			function isIn(text, match) {
				if (!text) return false;
				match = match.toLowerCase();
				text = typeof text === 'string' ? text.toLowerCase() :
					text.map(function(a) { return a.toLowerCase(); });
				return ~text.indexOf(match);
			}

			function calculateCount(tiddler) {
				var count = 0;
				count += tiddler.title === search ? 10 : 0;
				count += isIn(tiddler.title, search) ? 5 : 0;
				count += isIn(tiddler.tags, search) ? 3 : 0;
				count += isIn(tiddler.text, search) ? 1 : 0;
				return count;
			}

			return this.processTiddlers(tiddlers).sort(function(a, b) {
				var aCount = countHash[a.uri],
					bCount = countHash[b.uri];
				if (aCount == null) {
					aCount = calculateCount(a);
					countHash[a.uri] = aCount;
				}
				if (bCount == null) {
					bCount = calculateCount(b);
					countHash[b.uri] = bCount;
				}
				return (a > b) ? -1 : (a < b) ? 1 : (a.modified > b.modified) ?
					-1 : (a.modified < b.modified) ? 1 : 0;
			}).filter(function(t) { return countHash[t.uri] > 0; });
		},
		openTiddler: function(ev) {
			var target = ev.target;
			if (!newTabClick(ev)) {
				ev.preventDefault();
				window.history.pushState(undefined, target.textContent,
					target.href);
				renderer.render('view-tiddler', target.textContent);
				pub.trigger('mobile-toggle');
			}
		},
		loadUpdatedTiddler: function(tiddler, status) {
			var tmpEl, currEl, self = this,
				LIs = this.list.querySelectorAll('li'),
				i = 0, l = LIs.length;

			tiddler = this.processTiddlers(store.Collection([tiddler]))[0]

			if (!tiddler) return;

			for (; i < l; i++) {
				tmpEl = LIs[i];
				if (tmpEl.getAttribute('data-tiddler') === tiddler.title) {
					currEl = tmpEl;
					break;
				}
			}

			if (currEl && status === 'deleted') {
				this.list.removeChild(currEl);
			} else if (currEl) {
				this.list.removeChild(currEl);
				this.list.insertBefore(currEl, this.list.childNodes[0]);
			} else if (status !== 'deleted') {
				tmpEl = document.createElement('ul');
				renderer.render('mustache', tmpEl, templates['tiddlerList'], {
					tiddlers: [this.addInfo(tiddler)]
				}, function(tmp) {
					self.list.insertBefore(tmpEl.querySelector('li'),
						self.list.childNodes[0]);
				});
			}

		}
	});

	return Search;
});

/*
 * Dashboard like app for "doing" TiddlySpace
 */
// TODO: make work offline

require(['edit', 'pub', 'templates', 'render', 'search', 'utils', 'store'],
function(Edit, pub, templates, renderer, Search, utils, store) {

	// bootstrap the default HTML representation to match dash

	function bootstrap() {
		// detect if we are in dash directly or if we are in the HTML
		// representation
		var cache = {};
		if (document.getElementById('container')) {
			// seed the page with tiddler title and body
			cache.title = document.getElementById('header').textContent;
			cache.text = document.getElementById('text-html').innerHTML;

			// fetch the dash HTML
			store.get('dash', function(tiddler) {
				var el = document.createElement('div'), header;
				tiddler.text = tiddler.text.split('</head>')[1]; // XXX: hacky
				el.innerHTML = tiddler.text;
				document.body.innerHTML = el.innerHTML;
				el = document.querySelector('article');
				el.innerHTML = '<div><h2>' + cache.title + '</h2><div>' +
					cache.text + '</div></div>';
				el.setAttribute('data-tiddler', cache.title);
				// load in font awesome
				el = document.createElement('link');
				el.rel = 'stylesheet';
				el.href = 'http://tiddlyspace.com/bags/fonts_public/tiddlers/' +
					'font-awesome.css';
				document.head.appendChild(el);
				// load in viewport
				el = document.createElement('meta');
				el.name = 'viewport';
				el.content = 'width=device-width, maximum-scale=1.0, ' +
					'user-scalable=0';
				document.head.appendChild(el);
				// load in the web app notification
				el = document.createElement('meta');
				el.name = 'apple-mobile-web-app-capable';
				el.content = 'yes';
				document.head.appendChild(el);
				// load in icons
				el = document.createElement('link');
				el.rel = 'apple-touch-icon';
				el.href = 'http://tiddlyspace.com/bags/common/tiddlers/defaultSiteIcon';
				document.head.appendChild(el);
				el = document.createElement('link');
				el.rel = 'apple-touch-icon-precomposed';
				el.href = 'http://tiddlyspace.com/bags/common/tiddlers/defaultSiteIcon';
				document.head.appendChild(el);
				// reload the image as it gets cancelled and doesn't show in
				// Chrome otherwise
				el = document.createElement('img');
				el.alt = 'SiteIcon';
				el.src = '/SiteIcon';
				header = document.querySelector('header');
				header.removeChild(header.querySelector('img'));
				header.insertBefore(el, header.querySelector('h1'));
				// reload the backstage
				el = document.createEvent('Event');
				el.initEvent('load', true, true);
				window.dispatchEvent(el);

				loadDash();
			});
		} else {
			loadDash();
		}
	}

	document.addEventListener('DOMContentLoaded', bootstrap);
	if (~['complete', 'interactive'].indexOf(document.readyState)) {
		utils.makeAsync(bootstrap);
	}

	function loadDash() {
		var newTabClick = utils.newTabClick,
			extractTitle = function(text) {
				return decodeURIComponent(/(#?[^\/#]*)$/.exec(text)[1]);
			};

		pub.search = new Search(document.getElementById('search'));
		templates.domLoaded();

		// set document title
		store.getDefaults(function(c) {
			document.querySelector('header h1').textContent = c.pullFrom.name
				.replace(/_[^_]+/, '');
		});

		// load tiddlers into the list
		store.refresh(function(tiddlers) {
			pub.trigger('search.refresh', tiddlers);
		});

		// trap internal links in the tiddler
		document.querySelector('article')
			.addEventListener('click', function(ev) {
				var title, target = ev.target, space;
				if (ev.target.nodeName === 'A' && !newTabClick(ev)) {
					space = window.location.origin;
					if (target.href.indexOf(space) === 0) {
						ev.preventDefault();
						title = extractTitle(target.href);
						window.history.pushState(undefined, title, target.href);
						renderer.render('view-tiddler', title);
					}
				}
			});

		// trap links in the tag section
		document.getElementById('tags').addEventListener('click', function(ev) {
			var target = ev.target,
				tag;
			if (target.nodeName === 'A' && !newTabClick(ev)) {
				tag = decodeURIComponent(/tag:([^;&]+)$/.exec(target.href)[1]);
				window.history.pushState(undefined, document.title,
					target.href);
				pub.trigger('search.search', '#' + tag);
				pub.trigger('mobile-toggle');
				ev.preventDefault();
			}
		});

		// hook up the nav
		document.querySelector('nav').addEventListener('click', function(ev) {
			var target = ev.target, title;
			if ((target.nodeName === 'A' || target.parentNode.nodeName === 'A')
					&& !newTabClick(ev)) {
				title = extractTitle(target.href || target.parentNode.href);
				switch (title) {
					case '':
						pub.trigger('load-default');
						pub.trigger('mobile-toggle');
						break;
					case '#more':
						pub.trigger('more-click');
						ev.stopPropagation();
						break;
					default:
						window.history.pushState(undefined, target.title ||
							target.parentNode.title, target.href ||
							target.parentNode.href);
						renderer.render('view-tiddler', title);
						pub.trigger('mobile-toggle');
				}
				ev.preventDefault();
			}
		});

		// make the buttons in toolbar go
		document.getElementById('toolbar').addEventListener('click',
			function(ev) {
				var target = ev.target;
				if (target.nodeName === 'BUTTON' ||
						target.parentNode.nodeName === 'BUTTON') {
					pub.trigger((target.name || target.parentNode.name) +
						'-click');
				}
			});

		// hookup the edit button
		document.querySelector('#tiddlerActions button[name="edit"]')
			.addEventListener('click', function(ev) {
				var target = ev.target,
					title = document.querySelector('article')
						.getAttribute('data-tiddler');
				new Edit(title);
			});

		// hookup the reply button
		if (typeof window.createReplyButton === 'undefined') {
			script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = 'http://tiddlyspace.com/bags/reply_public/tiddlers/' +
				'_reply-button.js';
			script.addEventListener('load', function(ev) {
				createReplyButton(document
					.querySelector('#tiddlerActions button[name="reply"]'));
			});
			document.body.appendChild(script);
		}

		// hookup the mobile back button
		document.querySelector('button.mobile').addEventListener('click',
			function(ev) {
				pub.trigger('mobile-toggle');
			});

		// show the search elements
		pub.trigger('search.toggle', 'show');

		// XXX: dirty Android-has-a-rubbish-browser hack
		// via http://chris-barr.com/index.php/entry/scrolling_a_overflowauto_element_on_a_touch_screen_device/
		var uaStr = navigator.userAgent.match(/Android ([0-9]+)/);
		if (uaStr && parseInt(uaStr[1], 10) < 3) {
			[document.querySelector('#search ul'),
				document.querySelector('article')].forEach(function(el, i) {
					var scrollStartPosY = 0,
						scrollStartPosX = 0;
					el.addEventListener('touchstart', function(ev) {
						scrollStartPosY = this.scrollTop + ev.touches[0].pageY;
						scrollStartPosX = this.scrollLeft + ev.touches[0].pageX;
					});
					el.addEventListener('touchmove', function(ev) {
						this.scrollTop = scrollStartPosY - ev.touches[0].pageY;
						this.scrollLeft = scrollStartPosX - ev.touches[0].pageX;
						ev.preventDefault();
					});
				});
		}

		// XXX: dirty prevent-iOS-scrolling-when-it-shouldn't-be hack
		[document.querySelector('#search ul'),
			document.querySelector('article')].forEach(function(el, i) {
				var scrollStartPosY = 0,
					startOffsetY = 0;
				el.addEventListener('touchstart', function(ev) {
					startOffsetY = ev.touches[0].pageY;
				});
				el.addEventListener('touchmove', function(ev) {
					var currentY = ev.touches[0].pageY;
					// prevent scrolling if at top or bottom of scroll area
					if (this.scrollTop === 0 && startOffsetY < currentY) {
						ev.preventDefault();
					} else if ((el.offsetHeight + el.scrollTop >=
							el.scrollHeight) && startOffsetY > currentY) {
						ev.preventDefault();
					}
				});
			});
		// prevent scrolling on things that shouldn't scroll
		[].forEach.call(document.querySelectorAll('header,nav,#search form,' +
			'#toolbar,#tiddlerActions,#app-picker,#tags'), function(el) {
				el.addEventListener('touchmove', function(ev) {
					ev.preventDefault();
				});
			});

		app.run();
	}

	pub.on('edit', function(title) {
		new Edit(title);
	});

	pub.on('reply-click', function(el) {
		var script, _loadReply;

		_loadReply = function() {
			var ev = document.createEvent('Event');
			window.createReplyButton(el);
			ev.initEvent('click', true, true);
			el.dispatchEvent(ev);
		};

	});

	pub.on('tools', function(title, el) {
		var hide = function(ev) {
			el.className = el.className.replace('expand-tools', '');
			document.removeEventListener('click', hide);
		};
		if (el) {
			el.className += ' expand-tools';
			document.addEventListener('click', hide);
		}
	});

	pub.on('delete', function(title, el) {
		store.destroy(title, function(tiddler){
			if (tiddler) {
				el.parentNode.removeChild(el);
			}
			pub.trigger('load-default');
		});
	});

	var defaultTiddler;
	pub.on('load-default', function() {
		var load = function() {
			window.history.pushState(undefined, defaultTiddler, '/');
			renderer.render('view-tiddler', defaultTiddler);
		};

		if (!defaultTiddler) {
			store.get('DefaultTiddlers', function(tiddler) {
				if (tiddler && tiddler.text) {
					defaultTiddler = tiddler.text.split('\n')[0]
						.match(/^(?:\[\[)?([^\]\]]+)(?:\]\])?/)[1];
					load();
				} else {
					defaultTiddler = 'GettingStarted';
					load();
				}
			});
		} else {
			load();
		}
	});

	pub.on('star', function(text, el) {
		store.get('MainMenu', function(tiddler) {
			var links;
			if (!tiddler) {
				tiddler = new tiddlyweb.Tiddler('MainMenu');
			}
			links = tiddler.text.split('\n').filter(function(a) { return a; });
			if (!~links.indexOf(text)) {
				links.push(text);
			}
			tiddler.text = links.join('\n');

			store.save(tiddler, function() {});
		});
	});

	pub.on('more-click', function() {
		var el = document.getElementById('more'),
			hideMenu = function() {
				el.className = '';
				document.removeEventListener('click', hideMenu);
			};

		if (!/visible/.test(el.className)) {
			store.get('MainMenu', function(tiddler) {
				var links = tiddler.text.split('\n').map(function(title) {
					var match = /(?:\[\[)?([^\]\]]+)(?:\]\])?/.exec(title);
					if (match && match[1]) {
						if (match[1].charAt(0) === '#') {
							return {
								href: '/search?q=tag:' + match[1],
								text: match[1]
							};
						} else {
							return {
								href: '/' + match[1],
								text: match[1]
							};
						}
					}
				}).filter(function(title) { return title; });
				renderer.render('mustache', el, templates['moreTemplate'],
					{ titles: links });

				el.className += 'visible';
			});

			document.addEventListener('click', hideMenu);
			el.addEventListener('click', function(ev) {
				var target = ev.target, link;
				if (ev.target.nodeName === 'A') {
					link = target.textContent;
					if (link.charAt(0) === '#') {
						window.history.pushState(undefined, document.title,
							target.href);
						pub.trigger('search.search', target.textContent);
					} else {
						window.history.pushState(undefined, link,
							target.href);
						renderer.render('view-tiddler', link);
					}
					hideMenu();
					ev.preventDefault();
				}
			});
		} else {
			hideMenu();
		}
	});

	pub.on('new-click', function() {
		window.history.pushState(undefined, 'New Tiddler', 'New Tiddler');
		new Edit;
		pub.trigger('mobile-toggle');
		pub.trigger('search.toggle', 'show', function() {});
	});

	pub.on('refresh-click', function() {
		store.refresh(function(tiddlers) {
			pub.trigger('search.refresh', tiddlers);
		});
	});

	pub.on('mobile-toggle', function() {
		var menu = document.getElementById('sidebar'),
			article = [
				document.querySelector('header'),
				document.querySelector('article'),
				document.getElementById('tiddlerActions'),
				document.getElementById('bs-popup'),
				document.getElementById('app-picker'),
				document.getElementById('tags')
			];

		if (/mobile-active/.test(menu.className)) {
			menu.className = menu.className.replace('mobile-active', '');
			menu.className += ' mobile-inactive';
			article.forEach(function(el) {
				if (el) {
					el.className = el.className.replace('mobile-inactive', '');
					el.className = 'mobile-active';
				}
			});
		} else {
			article.forEach(function(el) {
				if (el) {
					el.className = el.className.replace('mobile-active', '');
					el.className = 'mobile-inactive';
				}
			});
			pub.trigger('search.toggle', 'show');
			menu.className = menu.className.replace('mobile-inactive', '');
			menu.className += 'mobile-active';
		}
	});

	var app = new routes();

	app.get('/bags/:bag/tiddlers/:tiddler', function(req) {
		var title = decodeURIComponent(req.params.tiddler);
		renderer.render('view-tiddler', title);
	});

	app.get('/:title', function(req) {
		var title = decodeURIComponent(req.params.title),
			tag;
		if (title === 'search') {
			tag = decodeURIComponent(/tag:([^;&]+)$/.exec(req.url)[1]);
			pub.trigger('search.search', '#' + tag);
		} else {
			renderer.render('view-tiddler', title);
		}
	});

	app.get('/', function(req) {
		pub.trigger('load-default');
		if (window.location.hash === '#more') {
			pub.trigger('more-click');
		}
	});
});

define("dash.js", function(){});
