
site: _site/out.js
	cp www/style.css _site/
	cp www/index.html _site/
	cp www/favicon.png _site/
	sed -Ei '' 's/.*script.*/<script src="out.js"><\/script>/' _site/index.html

_site/out.js : src/main.js src/compile.js src/runtime.js src/types.js src/prims.js
	node_modules/.bin/browserify src/main.js -t babelify | uglifyjs --mangle > _site/out.js

test:
	node_modules/.bin/moduleserve --host 0.0.0.0 --port 8000 --transform babel www

deploy:
	rsync -Pvraz _site/ scod:~daft/public_html/dev

setup:
	npm install --dev
	curl https://raw.githubusercontent.com/Yaffle/BigInteger/gh-pages/BigInteger.js > node_modules/js-big-integer/BigInteger.js
	sed -Ei '' 's/^}(this)/}(module ? module.exports : this)/' node_modules/js-big-integer/BigInteger.js
	sed -Ei '' 's/.replace(/\.js$/, ""))$//' node_modules/moduleserve/client.js

