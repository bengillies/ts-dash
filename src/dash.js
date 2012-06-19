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
