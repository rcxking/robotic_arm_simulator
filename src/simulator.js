/*
 * simulator.js - The dynamic Javascript code for the Robotic Arm Simulator.
 *
 * Bryant Pong
 * ECSE-4750
 * 10/18/14
 *
 * Last Updated: 12/1/14 - 4:08 PM
 */ 

var canvas;
var gl;

/***GLOBAL VARIABLES***/

/*** Numericals ***/

// The number of vertices to render:
var numberOfVertices = 0;

// The number of joints to render:
var numberOfJoints = 0;

/*** Arrays ***/

// These arrays hold the points and their respective colors to render:
var points = [];
var colors = [];

/*
 * This array holds the lengths of the joint links.  The ith link is the link
 * between ith joint and the i+1th joint.  For example, links[0] holds the link
 * P01.
 */
var links = [];

// This array holds the Cartesian locations of all the rotational joints:
var joints = [];

// All the coordinate axes are stored in this array:
var axes = [];

// All the rotation axes are stored in this array:
var rotationAxes = [];

// All the joint angles are stored in this array:
var jointAngles = [];
/***END SECTION GLOBAL VARIABLES***/

// Extraneous Variables to remove:
var NumVertices = 0;

/** END SECTION EXTRANEOUS VARIABLES TO REMOVE **/

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var axis = 0;
var theta = [ 0, 0, 0];

var thetaLoc;

var modelViewMatrix;
var modelViewMatrixLoc;

var projectionMatrix;
var projectionMatrixLoc;

var hasLoaded = 0;

/*
 * This function allows new joint elements to be added to the simulator webpage.
 * This function is used to create new slider elements when a new robot arm
 * joint is created.  Additionally, the new joint data is pushed to the vectors
 * for rendering:   
 *
 * TESTED/VERTIFIED
 */
function addJointCallback() {

	console.log("Now Adding New Joint");

	/*
	 * We will be using the DOM's createElement() function to create a slider 
	 * element to allow the user to control a single joint:
	 */
	var sliderElement = document.createElement("input");

	var jointName = "joint" + String(numberOfJoints);
	
	console.log("jointName: " + jointName);
	
	var type ="range";
	// Set the attributes of this new input element:
	sliderElement.setAttribute("id", jointName);
	sliderElement.setAttribute("type", "range");
	sliderElement.setAttribute("min", "-360");
	sliderElement.setAttribute("max", "360");
	sliderElement.setAttribute("value", "0");
	sliderElement.setAttribute("step", "1");
	
	jointAngles.push(0);

	// Increase the number of joints in the robot arm:
	numberOfJoints++;

	var currentJointNumber = numberOfJoints;
	
	sliderElement.addEventListener("change", function() { 
												//console.log("onchange triggered!"); 
												//console.log(jointName + " angle is: " + document.getElementById(jointName).value);
												jointAngles[currentJointNumber - 1] = document.getElementById(jointName).value;
												//console.log("jointAngles: " + jointAngles);
												render();
											}, false);
	
	// We need to get a generic item in the DOM to append the new element:
	var genericItem = document.getElementById("nonexistent");
	
	// Add the new input element into the page:
	genericItem.appendChild(sliderElement); 
	
	// Get the values of the arguments for the joints:
	var newJointXPos = Number(document.getElementById("newJointX").value);
	var newJointYPos = Number(document.getElementById("newJointY").value);
	var newJointZPos = Number(document.getElementById("newJointZ").value);
	
	var newJointRotXAxis = Number(document.getElementById("newJointRotXAxis").value);
	var newJointRotYAxis = Number(document.getElementById("newJointRotYAxis").value);
	var newJointRotZAxis = Number(document.getElementById("newJointRotZAxis").value);
	
	var rotationAxis = [newJointRotXAxis, newJointRotYAxis, newJointRotZAxis];
	
	var newJointColor = document.getElementById("newJointColor").value;
	
	// Convert the newJointColor (in hex) to a vec4 containing the RGB colors for the joint (VALIDATED):
	var convertedJointColor = convertColor(newJointColor);
	//console.log("convertedJointColor is: " + convertedJointColor);
	
	// Create the joint:
	joints.push([newJointXPos, newJointYPos, newJointZPos, convertedJointColor]);
	
	// Append the rotation axis:
	rotationAxes.push([newJointRotXAxis, newJointRotYAxis, newJointRotZAxis]);
	
	// If this is not the first joint (joint 0), then we need to prepare a link to be rendered:
	if(numberOfJoints != 1) {
		console.log("This is not the first joint; rendering a new link between the " + (currentJointNumber - 1) + " and the " + currentJointNumber + "th joint");
		
		
		// Calculate the X, Y, and Z changes between the previous joint and the new joint:
		var deltaX = joints[currentJointNumber - 1][0] - joints[currentJointNumber - 2][0];
		var deltaY = joints[currentJointNumber - 1][1] - joints[currentJointNumber - 2][1];
		var deltaZ = joints[currentJointNumber - 1][2] - joints[currentJointNumber - 2][2];
		
		// DEBUG ONLY - PRINT OUT THE deltas:
		console.log("deltaX: " + deltaX);
		console.log("deltaY: " + deltaY);
		console.log("deltaZ: " + deltaZ);
		
		if(deltaX == 0.0) {
			deltaX += 0.25;
		} 
		
		if(deltaY == 0.0) {
			deltaY += 0.25;
		} 
		
		if(deltaZ == 0.0) {
			deltaZ += 0.25;
		}
		
		links.push([deltaX, deltaY, deltaZ]);
	} // End if
	
	/*
	 * Finally, we need to append a row in the kinematics data table for this joint.
	 * This row will be populated in the render() functions.
	 */
	var dataTable = document.getElementById("kinematicsData");
	var tableRow = document.createElement('TR');
	dataTable.appendChild(tableRow);
	
} // End function addHTMLElement()

/*
 * The joint color is set by using the "newJointColor" HTML element.  We need
 * our joint color to be represented (in RGB) from a value of 0.0 to 1.0 for
 * each of the RGB components.  However, the HTML element will return a color
 * using Hexadecimal values from #000000 (black) - #FFFFFF (white).  The
 * following functions will facilitate in converting hexadecimal colors to
 * the appropriate decimal values.
 */

/* 
 * This function calculates the decimal values of a given hex RGB component.
 * 
 * Parameters: hexValue - The entire hex string rep. the color.
 *             color - The color to look for (either "red", "green", "blue")
 *
 * Returns: decimal value of the corresponding hex color.    
 *
 * TESTED/VALIDATED 11/5/14
 */
function colorHexToDec(hexValue, color) {
	
	/*
	 * hexValue is a string in the following form: #ffffff.  We must ignore
	 * hexValue[0] since it's the "#" sign.
	 */

	// We have 3 cases: "red", "green", "blue":
	switch(color) {		
		case "red":
			return parseInt(hexValue.substring(1, 3), 16);
			break;
		case "green":
			return parseInt(hexValue.substring(3, 5), 16);
			break;
		case "blue":
			return parseInt(hexValue.substring(5, 7), 16);
			break;

		// We should never reach this state:
		default:
			console.log("ERROR!");
			return -9001;
			break;
			
	} // End switch()
} // End function colorHexToDec()

/*
 * This function converts a hex RGB color value into a vec4 object 
 * representation.
 *
 * Parameters: hexValue (the hex RGB color to convert)
 * Returns: vec4() of all the hex colors:
 *
 * TESTED/VALIDATED 11/5/14
 */
function convertColor(hexValue) {
	
	// Get the decimal representations of each of the RGB components:
	var redValue = colorHexToDec(hexValue, "red");
	var greenValue = colorHexToDec(hexValue, "green");
	var blueValue = colorHexToDec(hexValue, "blue");

	/*
	 * We need to convert the colors from values ranging from 0 - 255
	 * to values from 0.0 - 1.0.  Using the classic linear equation
	 * y = mx + b, this equation is becomes y = x/255, where x is the
	 * value from 0 - 255 and y is the value from 0.0 to 1.0.
	 */
	var convertedRed = redValue / 255.0;
	var convertedGreen = greenValue / 255.0;
	var convertedBlue = blueValue / 255.0;

	// Construct and return the vec4() object containing these values:
	return vec4(convertedRed, convertedGreen, convertedBlue, 1.0);

} // End function convertColor()

var cBuffer;
/*
 * Onload - This function is executed when the browser is opened.  Equivalent
 * to int main() in C.
 */
window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

	// Origin Coordinate Frame:
	axes.push([0.0, 0.0, 0.0, 8.5, 0.0, 0.0, 0.05, 1]);
	axes.push([0.0, 0.0, 0.0, 0.0, 8.5, 0.0, 0.05, 2]);
	axes.push([0.0, 0.0, 0.0, 0.0, 0.0, 8.5, 0.05, 3]);
	drawAllAxes(axes);
	
	// Draw the reference cube:
	referenceCube();
	
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );
    
    cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );

    var vBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

	// Set the shader variable locations: 
	modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
	projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
	
	projectionMatrix = ortho(-10, 10, -10, 10, -10, 10);
	gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    	
	document.getElementById("newJoint").onclick = function() {
		
		addJointCallback();
	
		console.log("after the newJointButton was clicked, before rendering, NumVertices is: " + NumVertices);
		console.log("Before rendering, joints.length is: " + joints.length);
		render();
	};
	
	render();

	/** END REMOVE THIS SECTION **/
} // End function init()

/*** ADDITIONAL MATRIX/VECTOR FUNCTIONS ***/

/*
 * scaleMatrix() multiplies all elements in a matrix by a scalar.
 *
 * Inputs: scale (integer scalar)
 *         mat (the matrix to scale)
 * Returns: scaled matrix
 *
 * Verified/Tested 12/1/14
 */   
function scaleMatrix(scale, mat) {

	var scaledMat = mat3();
	
	for(var i = 0; i < mat.length; i++) {
		for(var j = 0; j < mat[0].length; j++) {
			scaledMat[i][j] = mat[i][j] * scale;
		} // End for
	} // End for

	return scaledMat;
} // End function scaleMatrix()

/*
 * multMatVec() multiples a matrix by a vector.  Assume that the matrix
 * and the vector have the same dimension.
 *
 * Inputs: matrix 
 *         vector
 * Returns: A vector of the outer-most dimensions.
 *
 * Tested/Verified: 12/1/14
 */
function multMatVec(matrix, vector) {
	
	// The final multiplication:
	var result = [];
	
	for(var i = 0; i < matrix.length; i++) {
	
		var rowSum = 0;
		
		for(var j = 0; j < matrix[i].length; j++) {
			rowSum += matrix[i][j] * vector[j];
		} // End for
		
		result.push(rowSum);
	} // End for
	
	return result;
} // End function multMatVec()

/*** END SECTION ADDITIONAL MATRIX/VECTOR FUNCTIONS ***/

/*** KINEMATICS FUNCTIONS ***/
/* 
 * rot2D() creates a 2-Dimensional rotation matrix.  This function requires
 * the angle to rotate by (in radians).
 *
 * Inputs: theta (rotation angle in radians)
 * Returns: 2x2 mat2() Rotation Matrix
 *
 * Verified/Tested 10/20/14
 */
function rot2D(theta) {
	return mat2(Math.cos(theta), -1 * Math.sin(theta), 
	            Math.sin(theta), Math.cos(theta));
} // End function rot2D()

/*
 * rot3D() creates a 3-Dimensional rotation matrix via the Euler-Rodrigues
 * formula.  This function requires a vector of length 3 for the rotation
 * axis and the rotation angle (in radians).
 *
 * Inputs: k (3x1 vector representing the axis of rotation)
 *         theta (rotation angle in radians) 
 * Returns: 3x3 Rotation Matrix
 */
function rot3D(k, theta) {

	/*
	 * The Euler-Rodrigues formula for 3D Rotations is the following equation:
	 * rot(k, theta) = Identity 3x3 + sin(theta) * kx + (1-cos(theta)) * kx * kx
	 * where kx is the skew-symmetric matrix:
	 *
	 *    0 -k[2] k[1]
	 *  k[2]   0 -k[0]
	 * -k[1] k[0]   0
	 */ 
	var kx = mat3(     0, -1*k[2],   k[1],
	                 k[2],     0, -1*k[0],
				  -1*k[1],   k[0],     0);
	console.log("kx is: " + kx);
	
	var I3 = mat3(1, 0, 0,
	              0, 1, 0,
                  0, 0, 1);
	console.log("I3 is: " + I3);

	var subMatrix = add(add(I3, scaleMatrix(Math.sin(theta), kx)),
	                    mult(scaleMatrix((1-Math.cos(theta)), kx), kx));

	return subMatrix;

} // End function rot3D()

/*** End Section Kinematics Functions ***/

/*** Drawing Functions ***/

// This function takes a list of all the links to draw and draws all of them:
function drawAllLinks(listOfLinks) {
	for(var i = 0; i < listOfLinks.length; i++) {
		drawLink(listOfLinks[i][0], listOfLinks[i][1], listOfLinks[i][2], listOfLinks[i][3], 
		         listOfLinks[i][4], listOfLinks[i][5], listOfLinks[i][6], listOfLinks[i][7]);
	} // End for
} // End function drawAllLinks()

// This function takes a list of the coordinate axes to draw and draws all of them:
function drawAllAxes(listOfAxes) {
	for(var i = 0; i < listOfAxes.length; i++) {
		drawLink(listOfAxes[i][0], listOfAxes[i][1], listOfAxes[i][2], listOfAxes[i][3], 
		         listOfAxes[i][4], listOfAxes[i][5], listOfAxes[i][6], listOfAxes[i][7]);
	} // End for
} // End function drawAllAxes()

// This function draws a link.  A link is represented by a rectangular prism:
// Use 0.01 for a joint link.
function drawLink(startX, startY, startZ,
                  endX,   endY,   endZ, widthOfLink, color) {
				  
	// Scaled link variables for a 4 foot long robot arm:
	var scaledStartX = startX / 4.0;
	var scaledStartY = startY / 4.0;
	var scaledStartZ = startZ / 4.0;
	var scaledEndX = endX / 4.0;
	var scaledEndY = endY / 4.0;
	var scaledEndZ = endZ / 4.0;
	
	// The vertices of the link:
	var vertices = [
        vec3(scaledStartX - widthOfLink, scaledStartY - widthOfLink, scaledStartZ + widthOfLink),
        vec3(scaledStartX - widthOfLink, scaledStartY + widthOfLink, scaledStartZ + widthOfLink),
        vec3(scaledEndX + widthOfLink, scaledEndY + widthOfLink, scaledEndZ + widthOfLink),
        vec3(scaledEndX + widthOfLink, scaledEndY - widthOfLink, scaledEndZ + widthOfLink),
        vec3(scaledStartX - widthOfLink, scaledStartY - widthOfLink, scaledStartZ - widthOfLink),
        vec3(scaledStartX - widthOfLink, scaledStartY + widthOfLink, scaledStartZ - widthOfLink),
        vec3(scaledEndX + widthOfLink, scaledEndY + widthOfLink, scaledEndZ - widthOfLink),
        vec3(scaledEndX + widthOfLink, scaledEndY - widthOfLink, scaledEndZ - widthOfLink)
    ];

	/*
	 * The link colors to choose from:
	 * 0: Black
	 * 1: Red
	 * 2: Green
	 * 3: Blue
	 */
	var linkColor = [vec4(0.0, 0.0, 0.0, 1.0),
	                 vec4(1.0, 0.0, 0.0, 1.0),
					 vec4(0.0, 1.0, 0.0, 1.0),
					 vec4(0.0, 0.0, 1.0, 1.0)
					 ];

	var verticesOfJoints = [1, 0, 3, 1, 3, 2,
                            2, 3, 7, 2, 7, 6,
                            3, 0, 4, 3, 4, 7,
                            6, 5, 1, 6, 1, 2,
                            4, 5, 6, 4, 6, 7,
                            5, 4, 0, 5, 0, 1 ];

    for(var i = 0; i < verticesOfJoints.length; i++) {
		points.push(vertices[verticesOfJoints[i]]);
		colors.push(linkColor[color]);
	} // End for

	// There are 36 vertices to render:
	NumVertices += 36;
	
} // End function drawLink()

// This function creates a black cube to be shaped for the joints and links:
function referenceCube() {
	quad(1, 0, 3, 2);
	quad(2, 3, 7, 6);
	quad(3, 0, 4, 7);
	quad(6, 5, 1, 2);
	quad(4, 5, 6, 7);
	quad(5, 4, 0, 1);
} // End function referenceCube()

function quad(a, b, c, d) 
{
    var vertices = [
        vec3( -0.5, -0.5,  0.5 ),
        vec3( -0.5,  0.5,  0.5 ),
        vec3(  0.5,  0.5,  0.5 ),
        vec3(  0.5, -0.5,  0.5 ),
        vec3( -0.5, -0.5, -0.5 ),
        vec3( -0.5,  0.5, -0.5 ),
        vec3(  0.5,  0.5, -0.5 ),
        vec3(  0.5, -0.5, -0.5 )
    ];

    var vertexColors = [
        [ 0.0, 0.0, 0.0, 1.0 ],  // black
        [ 1.0, 0.0, 0.0, 1.0 ],  // red
        [ 1.0, 1.0, 0.0, 1.0 ],  // yellow
        [ 0.0, 1.0, 0.0, 1.0 ],  // green
        [ 0.0, 0.0, 1.0, 1.0 ],  // blue
        [ 1.0, 0.0, 1.0, 1.0 ],  // magenta
        [ 1.0, 1.0, 1.0, 1.0 ],  // white
        [ 0.0, 1.0, 1.0, 1.0 ]   // cyan
    ];

    // We need to parition the quad into two triangles in order for
    // WebGL to be able to render it.  In this case, we create two
    // triangles from the quad indices
    
    //vertex color assigned by the index of the vertex
    
    var indices = [ a, b, c, a, c, d ];

    for ( var i = 0; i < indices.length; ++i ) {
        points.push( vertices[indices[i]] );
		colors.push(vertexColors[0]);
    } // End for
}

function scale4(a, b, c) {
	var result = mat4();
	result[0][0] = a;
	result[1][1] = b;
	result[2][2] = c;
	return result;
}

var JOINT_LENGTH = 0.75;
var JOINT_WIDTH = 0.75;
var JOINT_HEIGHT = 0.75;

// This function renders a single link:
function extrudeLink(linkToRender) {

	console.log("links[" + linkToRender + "][0] is: " + links[linkToRender][0]);
	console.log("links[" + linkToRender + "][1] is: " + links[linkToRender][1]);
	console.log("links[" + linkToRender + "][2] is: " + links[linkToRender][2]);

	var s = scale4(Number(links[linkToRender][0]), Number(links[linkToRender][1]), Number(links[linkToRender][2]));
	var instanceMatrix;
	
	if(links[linkToRender][0] != 0.25) {
		instanceMatrix = mult(translate(links[linkToRender][0] / 2, 0.0, 0.0), s);
	} else if(links[linkToRender][1] != 0.25) {
		instanceMatrix = mult(translate(0.0, links[linkToRender][1] / 2, 0.0), s);
	} else if(links[linkToRender][2] != 0.25) {
		instanceMatrix = mult(translate(0.0, 0.0, links[linkToRender][2] / 2), s);
	} // End if-else-if
	
	var t = mult(modelViewMatrix, instanceMatrix);
	console.log("t is: " + t);
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
	
	for(var i = 108; i < 108 + 36; i++) {
		colors[i] = vec4(0.0, 0.0, 0.0, 1.0);
	} // End for
	
	gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
	
	gl.drawArrays(gl.TRIANGLES, 108, 36);
} // End function extrudeLink()

// This function renders a single joint
function extrudeJoint(color) {
	var s = scale4(JOINT_LENGTH, JOINT_WIDTH, JOINT_HEIGHT);
	var instanceMatrix = mult(translate(0.0, 0.0, 0.0), s);
	var t = mult(modelViewMatrix, instanceMatrix);
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
	
	for(var i = 108; i < 108 + 36; i++) {
		colors[i] = color;
	} // End for
	
	gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
	
	gl.drawArrays(gl.TRIANGLES, 108, 36);
} // End function extrudeJoint()

// This function renders the coordinate axes:
function renderAxes() {
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
	gl.drawArrays(gl.TRIANGLES, 0, 108);
} // End function renderAxes();

// Rendering function:
function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// We want the camera to look from the point (1, 1, 1):
	modelViewMatrix = lookAt([0.1, 0.1, 0.1], [0.0, 0.0, 0.0], [0.0, 0.0, 1.0]);
	
	// Render the origin coordinate axes:
	renderAxes();
	
	// Render all joints and links:
	for(var i = 0; i < joints.length; i++) {
	
		// Is this the first joint to render?
		if(i == 0) {
			console.log("This is the first joint to render!");
			modelViewMatrix = mult(modelViewMatrix, translate(joints[0][0], joints[0][1], joints[0][2]));
			modelViewMatrix = mult(modelViewMatrix, rotate(jointAngles[i], rotationAxes[0][0], rotationAxes[0][1], rotationAxes[0][2]));
			extrudeJoint(joints[0][3]);
		} else {
			// A link must first be drawn before the next joint is rendered:
			console.log("This is the " + (i - 1) + " link to be rendered");
				
			console.log("Now extruding links[" + (i-1) + "]");
			
			/*
			 * The robot arm links will be in only either the X, Y, or Z directions.
			 * This logic determines whether to shift the link in the X, Y, or Z directions.
			 */
			
			if(links[i - 1][0] != 0.25) {
				// Translate in the X-Direction:
				console.log("Translating in the X-Direction!");
				modelViewMatrix = mult(modelViewMatrix, translate(JOINT_LENGTH / 2.0, 0.0, 0.0));
				extrudeLink(i-1);
				
				// Render the next joint:
				modelViewMatrix = mult(modelViewMatrix, translate(links[i-1][0], 0.0, 0.0));
				modelViewMatrix = mult(modelViewMatrix, rotate(jointAngles[i], rotationAxes[i][0], rotationAxes[i][1], rotationAxes[i][2]));
				extrudeJoint(joints[i][3]);
			} else if(links[i - 1][1] != 0.25) {
				// Translate in the Y-Direction:
				console.log("Translating in the Y-Direction!");
				modelViewMatrix = mult(modelViewMatrix, translate(0.0, JOINT_WIDTH / 2.0, 0.0));
				extrudeLink(i-1);
				
				// Render the next joint:
				modelViewMatrix = mult(modelViewMatrix, translate(0.0, links[i-1][1], 0.0));
				modelViewMatrix = mult(modelViewMatrix, rotate(jointAngles[i], rotationAxes[i][0], rotationAxes[i][1], rotationAxes[i][2]));
				extrudeJoint(joints[i][3]);
			} else {
				// Translate in the Z-Direction:
				console.log("Translating in the Z-Direction!");
				modelViewMatrix = mult(modelViewMatrix, translate(0.0, 0.0, JOINT_HEIGHT / 2.0));
				extrudeLink(i-1);
				
				// Render the next joint:
				modelViewMatrix = mult(modelViewMatrix, translate(0.0, 0.0, links[i-1][2]));
				modelViewMatrix = mult(modelViewMatrix, rotate(jointAngles[i], rotationAxes[i][0], rotationAxes[i][1], rotationAxes[i][2]));
				extrudeJoint(joints[i][3]);
			}
			
		} // End else-if
	} // End for
	
	// Let's now populate the kinematics table:
	console.log("Now populating kinematics table.");
	for(var i = 0; i < joints.length; i++) {
		
		// This is a reference to the kinematicsData table element:
		var dataTable = document.getElementById("kinematicsData");
		
		console.log("dataTable: " + dataTable);
		
		// Calculate the forward kinematics for this joint:
		
		/*
		 * Rotational forward kinematics:
		 * 
		 * The rotational forward kinematics is calculated by the sum of the previous
		 * joints of the arm (not including the current joint).
		 */
		var rotFwdKine = 0;
		
		for(var j = 0; j < i; j++) {
			rotFwdKine += Number(jointAngles[j]);
		} // End for
		
		console.log("Rotational Forward Kinematics: " + rotFwdKine);
		
		/*
		 * Translational forward kinematics:
		 *
		 * The translational forward kinematics is calculated by the following formula:
		 *
		 * P0T = P01 + R01 * P12 + R01 * R12 * P23 + ... + R0N * PNT
		 *
		 * In the simulator, the reference frame is attached to the first joint.  This means
		 * that P01 is 0 for all robot arms.
		 */
		var transFwdKine = [0, 0, 0];
		
		// Iterate through all the links:
		for(var j = 0; j < i; j++) {
		
			/*
			 * We need to reduce the X, Y, Z, values that are 0.25 to 0.
			 * These link values are 0.25 because that's the width of links to draw.
			 */
			var newLink = links[j].slice(0); // Make a copy by value, not by reference.
			if(newLink[0] == 0.25) {
				newLink[0] = 0.0;
			} // End if
			
			if(newLink[1] == 0.25) {
				newLink[1] = 0.0;
			} // End if
			
			if(newLink[2] == 0.25) {
				newLink[2] = 0.0;
			} // End if
			
			//console.log("links[j] is: " + links[j]);
			//console.log("newLink is: " + newLink);
		
			var rotationMatrix = mat3();
			console.log("For joint " + (i + 1) + " the initial rotation Matrix is: " + rotationMatrix);

			// Iterate through all the joints:
			for(var k = 0; k < i; k++) {
				console.log("joint[k] is: " + Number(jointAngles[k]) * Math.PI / 180.0);
				rotationMatrix = mult(rotationMatrix, rot3D(rotationAxes[k], Number(jointAngles[k]) * Math.PI / 180.0));
			} // End for
			
			console.log("For joint " + (i + 1) + " the rotationMatrix is: " + rotationMatrix + " and the link before it is length: " + newLink);
			var nextStep = multMatVec(rotationMatrix, newLink);
			
			transFwdKine = add(transFwdKine, nextStep);
			
		} // End for
		console.log("Translational Forward Kinematics: " + transFwdKine);
		
		// Populate this row for joint i:
		var td = document.createElement('TD');
		td.width = '75';
		td.appendChild(document.createTextNode("0"));
		dataTable.rows[i].appendChild(td);
	} // End for
	console.log("Done populating kinematics table!");
	
	console.log("Done rendering!");
	
} // End function render()

/*** END SECTION DRAWING FUNCTIONS ***/
