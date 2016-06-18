
site:
	node_modules/.bin/browserify src/main.js -t babelify | uglifyjs --mangle > _site/out.js
	cp www/index.html _site/
	cp www/style.css _site/

test:
	node_modules/.bin/moduleserve --host 0.0.0.0 --port 8888 --transform babel www

