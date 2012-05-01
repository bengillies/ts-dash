/*
 * Dashboard like app for "doing" TiddlySpace
 */
// TODO: make work offline

(function() {
	function makeAsync(fn) {
		window.setTimeout(fn, 0);
	}

	function curry(fn) {
		var curriedArgs = Array.prototype.slice.call(arguments, 1),
			self = this;
		return function() {
			var args = [].concat(curriedArgs);
			Array.prototype.push.apply(args, arguments);
			fn.apply(self, args);
		}
	}

	function Emitter() {}

	Emitter.prototype.trigger = function(feed) {
		var args = Array.prototype.slice.call(arguments, 1);
		if (Object.hasOwnProperty.call(this, feed)) {
			this[feed].forEach(function(fn) {
				makeAsync(curry.apply(undefined, [fn].concat(args)));
			});
		}
	};

	Emitter.prototype.on = function(feed, callback) {
		if (!Object.hasOwnProperty.call(this, feed)) {
			this[feed] = [callback];
		} else {
			this[feed].push(callback);
		}
	};

	Emitter.prototype.off = function(feed, fn) {
		var i, length, feedList;
		if (!callback) {
			delete this[feed];
		} else if (Object.hasOwnProperty.call(this, feed)) {
			feedList = this[feed];
			length = feedList.length;
			while (i < length) {
				if (feedList[i] === fn) {
					feedList.splice(i, 1)
				} else {
					i++;
				}
			}
		}
	};

	var pub = new Emitter();

	function Renderer() {
		var renderers = Object.create(null),
			emitter = new Emitter();

		return {
			render: curry.call(renderers, emitter.trigger),
			register: curry.call(renderers, emitter.on)
		}
	}

	var renderer = new Renderer();

	var store = tiddlyweb.Store();

	var makeFat = (function() {
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
	}());

	var templates = Object.create(null);

	// bootstrap the default HTML representation to match dash
	document.addEventListener('DOMContentLoaded', function() {
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
	});

	function loadDash() {
		var search = document.querySelector('#search'),
			newTabClick,
			extractTitle = function(text) {
				return decodeURIComponent(/(#?[^\/#]*)$/.exec(text)[1]);
			};

		newTabClick = function(ev) {
			return ev.altKey || ev.metaKey || ev.ctrlKey || ev.shiftKey ||
				ev.keyCode;
		};

		// cache the templates
		[].forEach.call(document
			.querySelectorAll('script[type="text/x-template"]'),
			function(template) {
				templates[template.id] = template.textContent;
			});

		// set document title
		store.getDefaults(function(c) {
			document.getElementById('title').textContent = c.pullFrom.name
				.replace(/_[^_]+/, '');
		});

		// load tiddlers into the list
		pub.on('tiddlers-loaded', function(tiddlers) {
			pub.trigger('refresh-tiddlers', tiddlers);
			search.querySelector('ul')
				.addEventListener('click', function(ev) {
					var target = ev.target;
					if (target.nodeName === 'A' && !newTabClick(ev)) {
						ev.preventDefault();
						window.history.pushState(undefined,
							target.textContent, target.href);
						renderer.render('view-tiddler', target.textContent);
						pub.trigger('mobile-toggle');
					}
				});
		});
		store.refresh(function(tiddlers) {
			// load tiddlers
			pub.trigger('tiddlers-loaded', tiddlers);
		});


		// listen for searches/filter changes
		var searchTimer;
		search.querySelector('input[type="search"]').addEventListener('keyup',
			function(ev) {
				if (searchTimer) window.clearTimeout(searchTimer);
				// wait for a pause in typing before searching
				searchTimer = window.setTimeout(function() {
					pub.trigger('refresh-tiddlers', store(), 'skinny');
				}, 500);
			});
		search.querySelector('form').addEventListener('submit', function(ev) {
			ev.preventDefault();
			pub.trigger('refresh-tiddlers', store());
		});
		search.querySelector('form').addEventListener('click',
			function(ev) {
				if ((ev.target.getAttribute('type') === 'radio') ||
						(ev.target.parentNode.nodeName === 'LABEL')){
					pub.trigger('refresh-tiddlers', store());
				}
			});

		// hook up the tool button(s)
		search.addEventListener('click', function(ev) {
			var locateTid = function(loadEvent) {
				var link, listEl, el = ev.target;
				listEl = (el.parentNode.nodeName === 'LI') ? el.parentNode :
					(el.parentNode.parentNode.nodeName === 'LI') ?
						el.parentNode.parentNode :
						el.parentNode.parentNode.parentNode;
				link = listEl.querySelector('[type="search"], a');
				link = link.value ? link.value : extractTitle(link.href);
				pub.trigger(loadEvent, link, listEl);
			}
			var target = (ev.target.nodeName === 'BUTTON') ? ev.target :
				(ev.target.parentNode.nodeName === 'BUTTON') ?
				ev.target.parentNode : null;

			if (target){
				switch(target.className) {
					case 'star': locateTid('star'); break;
					case 'tools': locateTid('expand-tools'); break;
					case 'delete': locateTid('delete');
				}
			}
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
				pub.trigger('search', '#' + tag);
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
				pub.trigger(target.name + '-click', title);
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
		pub.trigger('toggle-search', 'show');

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

	pub.on('edit-click', function(title) {
		var el = document.getElementsByTagName('article')[0],
			gatherFields,
			figureTags;

		figureTags = function(tagString) {
			var brackets = /^\s*\[\[([^\]\]]+)\]\](\s*.*)/,
				whitespace = /^\s*([^\s]+)(\s*.*)/,
				match,
				rest = tagString,
				tags = [];

			match = brackets.exec(rest) || whitespace.exec(rest);
			while (match) {
				tags.push(match[1]);
				rest = match[2];
				match = brackets.exec(rest) || whitespace.exec(rest);
			}

			return tags;
		};

		gatherFields = function(tiddler) {
			var newTid = new tiddlyweb.Tiddler({
					title: el.querySelector('input[name="title"]').value,
					text: el.querySelector('textarea[name="text"]').value,
					tags: figureTags(el.querySelector('input[name="tags"]')
						.value),
					fields: {}
				}), i, l, field, value
				fieldList = el.querySelectorAll('fieldset input');

			for(i = 0, l = fieldList.length; i < l; i++) {
				field = fieldList[i];
				if (field.className === 'key' && field.value) {
					value = fieldList[++i];
					if (value.value) {
						newTid.fields[field.value] = value.value;
					}
				}
			}

			if (newTid.fields['server.content-type']) {
				newTid.type = newTid.fields['server.content-type'];
			}
			newTid.bag = new tiddlyweb.Bag(tiddler.bag.name, tiddler.bag.host);
			newTid['public'] = !el.querySelector('input[name="private"]')
				.checked;

			newTid.bag.name = newTid.bag.name.replace(/_[^_]+$/,
				(newTid['public']) ? '_public' : '_private');

			return newTid;
		};

		store.get(title || 'New Tiddler', function(tiddler) {
			var isNew = false;
			if (!tiddler) {
				isNew = true;
				tiddler = new tiddlyweb.Tiddler(title || 'New Tiddler');
				tiddler.bag = store.getDefaults().pushTo;
			}
			var key, newFields = [], fields = tiddler.fields;
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

			renderer.render('mustache', el, templates['tiddlerEdit'], tiddler,
				function(el) {
					var fieldsFn,
						fieldset = el.querySelector('fieldset');

					// add a cancel button event handler
					el.querySelector('.buttons input[type="button"]')
						.addEventListener('click', function(ev) {
							ev.preventDefault();
							// remove any changes
							store.remove(tiddler);
							if (isNew) {
								pub.trigger('load-default');
							} else {
								renderer.render('view-tiddler', tiddler.title);
							}
						});

					// add a fields expander
					fieldsFn = function(ev) {
						switch(ev.target.nodeName) {
							case 'LEGEND':
								fieldset.className = (fieldset.className ===
									'visible') ? 'hidden' : 'visible';
								break;
							case 'FIELDSET':
								fieldset.className = 'visible';
						}
						ev.stopPropagation();
					};
					el.querySelector('fieldset').addEventListener('click',
						fieldsFn);
					el.querySelector('legend').addEventListener('click',
						fieldsFn);

					// add a new field handler
					el.querySelector('fieldset [type="button"]')
						.addEventListener('click', function(ev) {
							var list = el.querySelector('dl');
							list.innerHTML += ['<dt>',
								'<input type="text" class="key">',
								'</dt>',
								'<dd>',
								'<input type="text" class="value">',
								'</dd>'].join('\n');
							list = list.querySelectorAll('.key');
							list[list.length - 1].focus();
						});

					// cache changes
					el.querySelector('form').addEventListener('keyup',
						function(ev) {
							if (ev.target.name !== 'title') {
								var newTid = gatherFields(tiddler);
								store.add(newTid);
							}
						});

					// add a submit button event handler
					el.querySelector('form')
						.addEventListener('submit', function(ev) {
							var newTid = gatherFields(tiddler);

							store.save(newTid, function(tid) {
								if (tid) {
									// remove the old tiddler
									if (tid.title !== tiddler.title ||
											tid.bag.name !== tiddler.bag.name) {
										store.destroy(tiddler, function(t) {
											if (!t) {
												alert('There was a problem ' +
													'moving' + t.title + '.');
											}
										});

										window.history.pushState(undefined,
											tid.title, tid.title);
										renderer.render('view-tiddler', title);
									}

									renderer.render('view-tiddler',
										tid.title);
								} else {
									alert('There was a problem saving ' +
										newTid.title + '.');
								}
							});

							ev.preventDefault();
						});

					// focus on the title by default
					el.querySelector('input[name="title"]').focus();
				});
		});

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

	pub.on('expand-tools', function(title, el) {
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
						pub.trigger('search', target.textContent);
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
		pub.trigger('edit-click');
		pub.trigger('mobile-toggle');
		pub.trigger('toggle-search', 'show', function() {});
	});

	pub.on('refresh-click', function() {
		store.refresh(function(tiddlers) {
			pub.trigger('refresh-tiddlers', tiddlers);
		});
	});

	pub.on('toggle-search', function(action, callback) {
		var animate = false;
			search = document.getElementById('search');
		[].forEach.call(search.querySelectorAll('form, ul'), function(el) {
			if (el.className !== action) {
				el.className = action;
				animate = true;
			}
		});
		if (animate) {
			setTimeout(callback, 1000); // XXX: detect when the transition finishes
		} else {
			makeAsync(callback);
		}
	});

	pub.on('share-click', function() {
		var script, _share;

		_share = function() {
			var intent = new Intent('http://webintents.org/share',
				'text/uri-list', window.location.href);
			window.navigator.startActivity(intent);
		};

		if (typeof window.Intent === 'undefined') {
			script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = 'http://webintents.org/webintents.min.js';
			script.addEventListener('load', function() {
				_share();
			});
			document.body.appendChild(script);
		} else {
			_share();
		}
	});

	pub.on('search', function(searchString) {
		var search = document.querySelector('#search input[type="search"]');

		search.value = searchString;
		pub.trigger('refresh-tiddlers', store());
	});

	pub.on('refresh-tiddlers', function(tiddlers, skinny) {
		var container = document.querySelector('#search'),
			el = container.querySelector('ul'),
			filter = container.querySelector('input[type="radio"]:checked')
				.value,
			search = container.querySelector('input[type="search"]').value,
			radios = {
				all: container.querySelector('[type="radio"][value="All"]'),
				def: container.querySelector('[type="radio"][value="All"]'),
				priv: container.querySelector('[type="radio"][value="All"]')
			},
			render = curry.call(renderer, renderer.render, 'mustache'),
			applyFilters, addIcon, searchFn;

		processTiddlers = function(tiddlers) {
			switch (filter) {
				case 'Private':
					tiddlers = tiddlers.filter(function(tiddler) {
						return /_private$/.test(tiddler.bag.name);
					});
					// follow through...
				case 'Default':
					tiddlers = tiddlers.space().find('!#excludeLists');
			}
			return tiddlers.map(addInfo);
		};

		addInfo = function(tiddler) {
			var space = tiddler.bag.name.split('_'),
				currentSpace = store.recipe.name.split('_'),
				spaceMatch = space[0] === currentSpace[0];
			tiddler.icon = spaceMatch ?
				'/bags/tiddlyspace/tiddlers/' + space[1] + 'Icon' :
				'http://' + space[0] + '.tiddlyspace.com/SiteIcon';
			tiddler.space = spaceMatch ? space[1] : space[0];
			return tiddler;
		};

		searchFn = function(tiddlers) {
			var isIn = function(text, match) {
				if (!text) return false;
				match = match.toLowerCase();
				text = typeof text === 'string' ? text.toLowerCase() :
					text.map(function(a) { return a.toLowerCase(); });
				return ~text.indexOf(match);
			};
			var countHash = {};
			var calculateCount = function(tiddler) {
				var count = 0;
				count += tiddler.title === search ? 10 : 0;
				count += isIn(tiddler.title, search) ? 5 : 0;
				count += isIn(tiddler.tags, search) ? 3 : 0;
				count += isIn(tiddler.text, search) ? 1 : 0;
				return count;
			};
			return processTiddlers(tiddlers).sort(function(a, b) {
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
		};

		if (search) {
			try {
				// has a filter string been passed in?
				render(el, templates['tiddlerList'], {
					tiddlers: processTiddlers(tiddlers.find(search))
						.sort('-modified')
				});
			} catch(e) {
				if (!skinny) {
					// XXX: switch to using tiddlyweb search instead
					makeFat(function() {
						render(el, templates['tiddlerList'], {
								tiddlers: searchFn(store())
							});
					});
				} else {
					render(el, templates['tiddlerList'], {
						tiddlers: searchFn(tiddlers)
					});
				}
			}
		} else {
			render(el, templates['tiddlerList'], {
				tiddlers: processTiddlers(tiddlers).sort('-modified')
			});
		}

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
			pub.trigger('toggle-search', 'show');
			menu.className = menu.className.replace('mobile-inactive', '');
			menu.className += 'mobile-active';
		}
	});

	renderer.register('mustache', function(el, template, obj, callback) {
		if (el && template) {
			el.innerHTML = Mustache.to_html(template, obj);
			if (typeof callback ===  'function') {
				callback(el);
			}
		}
	});

	renderer.register('tiddler-text', function(title, callback) {
		var tiddler = store.get(title),
			el = document.createElement('div'),
			render = curry.call(renderer, renderer.render, 'mustache', el);

		store.get(title, function(tiddler, err, xhr) {
			if (!tiddler || (xhr && ~[404].indexOf(xhr.status))) { // XXX: finish error code list
				// no tiddler found so open edit mode with the new tiddler title
				pub.trigger('edit-click', title);
				return;
			}
			if (/^image\//.test(tiddler.type)) {
				pub.trigger('toggle-search', 'show', function() {
					render(templates['tiddlerImage'], tiddler, callback);
				});
			} else if (tiddler.type === 'text/html') {
				pub.trigger('toggle-search', 'hide', function() {
					render(templates['tiddlerHTML'], tiddler, callback);
				});
			} else if (tiddler.render) {
				pub.trigger('toggle-search', 'show', function() {
					render(templates['tiddlerText'], tiddler, callback);
				});
			} else {
				pub.trigger('toggle-search', 'show', function() {
					render(templates['tiddlerCode'], tiddler, callback);
				});
			}

			renderer.render('mustache', document.getElementById('tags'),
				templates['tiddlerTags'], tiddler);
		}, true);
	});

	renderer.register('view-tiddler', function(title) {
		document.querySelector('article').innerHTML = '';
		renderer.render('tiddler-text', title, function(text) {
			var el = document.querySelector('article');
			text = text.innerHTML;
			renderer.render('mustache', el, templates['viewTiddler'],
				{ text: text });

			el.setAttribute('data-tiddler', title);
			document.title = title;
		});
	});

	var app = new routes();

	app.get('/bags/:bag/tiddlers/:tiddler', function(req) {
		var title = decodeURIComponent(req.params.title);
		renderer.render('view-tiddler', title);
	});

	app.get('/:title', function(req) {
		var title = decodeURIComponent(req.params.title),
			tag;
		if (title === 'search') {
			tag = decodeURIComponent(/tag:([^;&]+)$/.exec(req.url)[1]);
			pub.trigger('search', '#' + tag);
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
}());
