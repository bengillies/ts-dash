.PHONY: test upload build

build:
	cd src && r.js -o name=dash.js out=../dash.js baseUrl=. optimize=none

upload: build
	tsupload dash dash.{js,html}
	tsupload dash HtmlCss.css -N HtmlCss

test:
	qunit test/index.html

