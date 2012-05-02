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
				search = this.getSearchString();

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
				render(el, templates['tiddlerList'], {
					tiddlers: this.processTiddlers(tiddlers).sort('-modified')
						.bind(function(tiddler) {
							var tmpEl = document.createElement('ul');
							render(tmpEl, templates['tiddlerList'], {
								tiddlers: [self.addInfo(tiddler)]
							}, function(tmp) {
								el.insertBefore(tmp.querySelector('li'),
									el.childNodes[0]);
							});
						})
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
		}
	});

	return Search;
});
