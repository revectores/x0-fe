all: clean
	cd app/addon; node-gyp rebuild --target=16.0.5 --dist-url=https://atom.io/download/electron
	electron-packager .

clean:
	rm -rf x0-fe-darwin-arm64

run:
	./x0-fe-darwin-arm64/x0-fe.app/Contents/MacOS/x0-fe
	
