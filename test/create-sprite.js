// import the module file to use in the next call
var csssprite = require('../src/csssprite');
/**
 * creates the css sprite.
 *
 * All png files in the directory <code>sourceDirectory</code> are concatenated to a single image file <code>imageFile</code>. 
 * A sytelsheet is dumped to <code>cssFile</code> and a test html page to <code>htmlTestFile</code>.
 */
csssprite.createSprite({
	sourceDirectory: "images", 
	fileNameFilter: "*png", 
	imageFile: "icon-sprite.png", 	// optional; default is icon-sprite.png
	cssFile: "icons.css", 		  	// optional; not generated if undefined
	htmlTestFile: "test.html"     	// optional; not generated if undefined
});