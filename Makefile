
site: _site/out.js
	cp www/style.css _site/
	cp www/index.html _site/
	sed -Ei '' 's/.*script.*/<script src="out.js"><\/script>/' _site/index.html

_site/out.js : src/main.js src/compile.js src/runtime.js src/types.js src/prims.js
	node_modules/.bin/browserify src/main.js -t babelify | uglifyjs --mangle > _site/out.js

test:
	node_modules/.bin/moduleserve --host 0.0.0.0 --port 8888 --transform babel www

deploy:
	rsync -Pvraz _site/ scod:~daft/public_html/dev

