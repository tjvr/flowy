
site:
	node_modules/.bin/browserify src/main.js -t babelify | uglifyjs --mangle > _site/out.js
	cp www/index.html _site/
	cp www/style.css _site/

test:
	node_modules/.bin/moduleserve --host 0.0.0.0 --port 8888 --transform babel www

setup:
	npm install --dev
	curl https://raw.githubusercontent.com/Yaffle/BigInteger/gh-pages/BigInteger.js > node_modules/js-big-integer/BigInteger.js
	sed -Ei '' 's/^}(this)/}(module ? module.exports : this)/' node_modules/js-big-integer/BigInteger.js
	sed -Ei '' 's/.replace(/\.js$/, ""))$//' node_modules/moduleserve/client.js

