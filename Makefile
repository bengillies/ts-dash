.PHONY: test upload

upload:
	find src -type f | egrep -v 'css|swp$$' | xargs -I {} tsupload dash {}
	tsupload dash src/HtmlCss.css -N HtmlCss

test:
	qunit test/index.html

