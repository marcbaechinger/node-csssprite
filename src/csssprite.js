/**************************************************************************
    // import csssprite module
	var csssprite = require('csssprite');
	
   	csssprite.createIconSprite({
		sourceDirectory: "/Users/marcbaechinger/projects/node/jslint/src/images/sprite/", 
		fileNameFilter: "*png", 
		imageFile: "icon-sprite.png", 	// optional; default is icon-sprite.png
		cssFile: "icons.css", 		  	// optional; not generated if undefined
		htmlTestFile: "test.html"     	// optional; not generated if undefined
	});
**************************************************************************/
var im = require('imagemagick'), // the imagemagick module
	fs = require('fs'), // the file system module
	verbose = false,
	defaultImageFile = "icon-sprite.png",
	defaultFileNameFilter = "*png";

//=========================================================================
// 	 exports

/**
 * creates the icon sprite for a given image selection
 *  
 *  <pre><code>
 *   var specExample = {
 *	   	sourceDirectory: "/Users/marcbaechinger/projects/node/jslint/src/images/sprite/", 
 *	    fileNameFilter: "*png", 
 * 	    imageFile: "icon-sprite.png", 
 *		cssFile: "icons.css", 
 *	    htmlTestFile: "test.html"
 *	 }</code></pre>
 *
 * @param spec the specification object
 */
exports.createSprite = function(spec) {
	// an array of processors to process the selected images
	var imageProcessors = [];

	// set default values if required
	spec.sourceDirectory = spec.sourceDirectory || "./"; // default: current working directory
	spec.fileNameFilter = spec.fileNameFilter || defaultFileNameFilter; // default: all png files
	spec.imageFile = spec.imageFile || defaultImageFile; // default out file 

	if (spec.cssFile) {
		// only if requested 
		imageProcessors.push(createStyleSheetBuilder(spec.cssFile));
	}
	if (spec.htmlTestFile) {
		// only if requested
		imageProcessors.push(createHtmlTestBuilder(spec.htmlTestFile, spec.cssFile));
	}
	// always create the sprite image
	imageProcessors.push(createSpriteBuilder(spec.imageFile));
	// get info and call processors
	getImageInfo(spec.sourceDirectory, spec.fileNameFilter, imageProcessors);	
};

// 		end of exports
//=========================================================================


/**
* creates an array of objects having the properties width, heigth, name and path
* of each image in directory <code>path</code>. The array is passed
* as argument to the <code>callback(s)</code>.
*
* @param path {String} the path to the directory containing the images
* @param selector {String} a selector to select the images to include (eg. *png for all png images in the directory)
* @param callback {Function || Array of Functions} the function(s) to pass the resulting array of image metadata
*/
var getImageInfo = function(path, selector, callback) {
	if (path[path.length-1] !== '/') {
		path += "/";
	}
	// use identify to get width, height and filename for each image selected by path + selector
	im.identify(["-format", "%w %h %f\n", path + selector], function(err, output) {
		// do nothing on error
		if (err) throw err;
		
		var lines = output.trim().split('\n'), // a line for each image
			i, imgTokens, img, // vars used inside the for loop 
			imagesInfo = []; // the array to hold all the image info
		
		// convert to array if a single callback function has been passed
		if (!isArray(callback)) {
			callback = [callback];
		}
		
		for (i = 0 ; i < lines.length; i++) {
			imgTokens = lines[i].split(" ");
			imagesInfo.push({
				width: imgTokens[0],
				height: imgTokens[1],
				name: imgTokens[2],
				path: path
			});
		}
		
		// call all callbacks and pass the image info
		for (i = 0; i < callback.length; i++) {
			if (typeof callback[i] === "function") {
				callback[i](imagesInfo);
			}
		}
	});
};
/**
 * creates a function 'curryied' with the target path of the resulting image
 *
 * @param targetPath the path to the final sprite image file
 * @return a function to pass the images to concatenate to
 */
var createSpriteBuilder = function(targetPath) {
	return function(images) {
		var convertArguments = [], 
			lengthSqrt = Math.sqrt(images.length), // compute sqrt only once
			cols = lengthSqrt  % 1 === 0 ? Math.floor(lengthSqrt) : Math.floor(lengthSqrt) + 1,
			i, // loop counter
			rows = Math.ceil(images.length / cols), // number of rows				
			rowsSetCount =  0,
			rowImages = [],
			/**
			 * add the path of the image of row <code>idx</code>. If all rows
			 * are retrieved they are concatenated to a single image
			 * 
			 * @param rowIdx {Number} the index of the row
			 * @param rowPath {String} the path to the row image  
			 */
			addImageRowCallback = function(rowIdx, rowPath) {
				// add the row
				rowImages[rowIdx] = rowPath;
				// have we received all rows yet?
				if (++rowsSetCount === rows) {
					// creation of all rows has completed; log some info
					console.log("join images to ", targetPath,
						": num of images", images.length, 
						", rows", rowImages.length,
						", cols", cols
					);
					// concatenate all rows to a single image in targetPath
					concatenateRows(rowImages, targetPath);
				}
			};
							
		for (i = 0; i < images.length; i++) {
			convertArguments.push(images[i].path + images[i].name);
			// check if row is full or last image is reached 
			if (i == images.length -1 || convertArguments.length == cols) {
				// create a row image
				concatenateToRow(convertArguments, Math.floor(i/cols), addImageRowCallback);
				// reset image array
				convertArguments = [];
			}
		}
	};
};

/**
 * concates the images horizontaly to a row
 * 
 * @param image {Array} the paths to the images to concate
 * @param targetPath the path of the resulting image
 */
var concatenateToRow = function(imagePaths, rowIndex, callback) {
	var convertArguments = imagePaths,
		targetPath = "_row-" + rowIndex + ".png"; // temporary target file 
			
	// command line arg: append horizontally
	convertArguments.push("+append"); 
	// command line arg: target file
	convertArguments.push(targetPath);
	// concatenate images by using image magick convert 
	im.convert(convertArguments, function(err, stdout, stdin) {
		if (err) throw err;
		if (verbose) {
			console.log("created image for row ", "rowIndex=" + rowIndex, "path=" + targetPath);
		}
		callback(rowIndex, targetPath);
	});
};
/**
 * concatenates images vertically to <code>targetPath</code>. If <code>deleteSourceImages</code>
 * is true the source images are deleted.
 *
 * @param image {Array of Strings} the paths to the images to concatenate
 * @param targetPath {String} the path to the target image
 * @param deleteRowImages {boolean} if true the source images are deleted
 */
var concatenateRows = function(images, targetPath) {
	var convertArguments = images;
	
	convertArguments.push("-append"); // append vertically
	convertArguments.push(targetPath);
	
	im.convert(convertArguments, function(err, stdout, stdin) {
		if (err) throw err;
		var i;
		// delete rows
		for (i = 0; i < images.length - 2; i++) {
			fs.unlinkSync(images[i]);
			if (verbose) {
				console.log("delete image file ", "path=" + images[i]);
			}
		}
	});
};

/**
 * writes a given <code>text</code> to a file in <code>path</code>.
 *
 * @param path {String} the path to the file to write
 * @param text {String} the text to write to the file
 */
var writeToFile = function(path, text) {	
	fs.writeFile(path, text, function (err) {
	  if (err) throw err;
	  console.log('It\'s saved to ' + path + '!');
	});
};

/**
* creates style rules for the icons for which an info line is stored
* in the given <code>infoArray</code>.
*
* @param infoArray {Array} an array of strings. Each string is a line with formar '<code>width height filename</code>'.
* @return {String} the class style rules for all images in the array
*/
var createStyleSheetBuilder = function(path) {
	return function(images) {
		var buf = [], // holds the final output
			i = 0,  image, // var used in loop
			yOffset = 0, // offset to sum up
			xOffset = 0, // offset to sum up
			lengthSqrt = Math.sqrt(images.length), // compute sqrt only once
			cols = lengthSqrt  % 1 === 0 ? Math.floor(lengthSqrt) : Math.floor(lengthSqrt) + 1; 

		for (i; i < images.length; i++) {
			image = images[i];
		
			if (i % cols === 0) {
				// reset x offset (carriage return)
				xOffset = 0;
				if (i != 0) {
					// raise y offset (line feed; next row)
					yOffset += parseInt(image.height, 10);
				}
			} else {
				// raise y offset (next col)
				xOffset += parseInt(image.width, 10);
			}
		
			// icon class rule
			buf.push(".icon-");
			buf.push(image.name.substring(0, image.name.lastIndexOf(".")));
			buf.push(" { ");

			buf.push("background: url(icon-sprite.png) -");
			buf.push(xOffset);
			buf.push("px -");
			buf.push(yOffset);
			buf.push("px; ");

			buf.push("height: ");
			buf.push(image.height);
			buf.push("px; ");

			buf.push("width: ");
			buf.push(image.width);
			buf.push("px; ");

			buf.push("}\n");
		}
	
		if (path) {
			writeToFile(path, buf.join(''));
		}
	};
};

/**
 * creates a html table with all the icons created with css classes of the css sprite
 *
 * @param images {Array} the images for which to create a test table
 */
var createHtmlTestBuilder = function(path, stylePath) {
	return function(images) {
		var buf	 = [], // holds the final output
			i = 0,  image, // var used in loop
			yOffset = 0, // offset to sum up
			xOffset = 0, // offset to sum up
			lengthSqrt = Math.sqrt(images.length), // compute sqrt only once
			cols = lengthSqrt  % 1 === 0 ? Math.floor(lengthSqrt) : Math.floor(lengthSqrt) + 1; 
			
		buf.push("<html><head><title>CSS-Sprite test</title><link rel='stylesheet' type='text/css' href='");
		buf.push(stylePath);
		buf.push("'/></head><body><table>\n");
		
		for (i; i < images.length; i++) {
			image = images[i];
		
			buf.push("<tr><td>");
		
			buf.push("<div class='");
			buf.push("icon-");
			buf.push(image.name.substring(0, image.name.lastIndexOf(".")));
			buf.push("'></div></td><td>");
		
			if (i % cols === 0) {
				// reset x offset (carriage return)
				xOffset = 0;
				if (i != 0) {
					// raise y offset (line feed; next row)
					yOffset += parseInt(image.height, 10);
				}
			} else {
				// raise y offset (next col)
				xOffset += parseInt(image.width, 10);
			}
		
			buf.push("</td><td>");
			// icon class rule
			buf.push(".icon-");
			buf.push(image.name.substring(0, image.name.lastIndexOf(".")));
			buf.push("</td><td>-");

			buf.push(xOffset);
			buf.push("px");
			buf.push("</td><td>-");
			buf.push(yOffset);
			buf.push("px; ");
		
			buf.push("</td></tr>\n");
		}
		buf.push("</table></body></html>\n");
		
		// do i/o
		writeToFile(path, buf.join(''));
	}
};
/**
 * return <code>true</code> if <code>obj</code> is an <code>Array</code> according
 *   to some duck typing.
 *
 * @param obj {Object} the object to test for arrayness
 * @return {boolean} <code>true</code> if its an array.
 */
var isArray = function(obj) {
	return Object.prototype.toString.call(obj) === "[object Array]";
};