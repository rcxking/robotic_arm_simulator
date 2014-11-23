/*
 * simulator.js - The dynamic Javascript code for the Robotic Arm Simulator.
 *
 * Bryant Pong
 * ECSE-4750
 * 10/18/14
 *
 * Last Updated: 11/22/14 - 3:58 PM
 */ 

var canvas;
var gl;

// The number of vertices to render:
var NumVertices  = 0;

var points = [];
var colors = [];

// This array holds the Cartesian locations of all the rotational joints:
var joints = [];

/*
 * This array holds the lengths of the joint links.  The ith link is the link
 * between ith joint and the i+1th joint.  For example, links[0] holds the link
 * P01.
 */
var links = [];

/*
 * This vector holds the joint data for rendering with the GPU.
 *
 * The vector consists of 4 arrays in the following form:
 * 
 * var jointData = [ <1>, <2>, <3>, <4> ]
 * where:
 * <1>: This array contains an array containing the vertices in this joint.
 * <2>: This array contains a 3-element vector depicting the rotation axis of this joint.
 * <3>: This array contains the 3D rotation matrix from the ith - 1 to the ith joint
 * <4>: This array contains the color of the ith joint.
 */
 var jointData = [];
 jointData.push([]);
 jointData.push([]);
 jointData.push([]);
 jointData.push([]);
 
// Variable to keep track of the number of joints on the arm:
var numberOfJoints = 0; 

// These constants are used to represent a coordinate frame for the X-Y-Z origin frame:
var originFrameX = [1, 0, 0];
var originFrameY = [0, 1, 0];
var originFrameZ = [0, 0, 1];

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var axis = 0;
var theta = [ 0, 0, 0];

// All the rotation axes are stored in this array:
var rotationAxes = [];
// All the joint angles are stored in this array:
var jointAngles = [];

// Perspective Matrix Constants:
var left = -1.0;
var right = 1.0;
var ytop = 1.0
var near = -1;
var far = 1;
var bottom = -1.0;

var thetaLoc;

var modelViewMatrix;
var modelViewMatrixLoc;

var projectionMatrix;
var projectionMatrixLoc;

var hasLoaded = 0;

/*
 * For N joints, there are N - 1 joints.  This variable keeps track of whether we have
 * more than 1 joint, as if we just have a single joint, no link should be drawn.
 */
var beginDrawingLinks = false;

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

	var type ="range";
	// Set the attributes of this new input element:
	sliderElement.setAttribute("id", "temp");
	sliderElement.setAttribute("type", "range");
	sliderElement.setAttribute("min", "0");
	sliderElement.setAttribute("max", "360");
	sliderElement.setAttribute("value", "0");
	sliderElement.setAttribute("step", "1");
	
	sliderElement.addEventListener("change", function() { 
												console.log("onchange triggered!"); 
												theta[0] = document.getElementById("temp").value;
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
	console.log("convertedJointColor is: " + convertedJointColor);
	
	// Create the joint:
	joints.push([newJointXPos, newJointYPos, newJointZPos, convertedJointColor]);
	
	// Append the rotation axis:
	rotationAxes.push([newJointRotXAxis, newJointRotYAxis, newJointRotZAxis]);
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


/*
 * Onload - This function is executed when the browser is opened.  Equivalent
 * to int main() in C.
 */
window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

	// Test to draw coordinate axes:
	//drawLink(0.0, 0.0, 0.0, 1.5, 0.0, 0.0, 0.006, 1);
	//drawLink(0.0, 0.0, 0.0, 0.0, 1.5, 0.0, 0.006, 2);
	//drawLink(0.0, 0.0, 0.0, 0.0, 0.0, 1.5, 0.006, 3);
    
 	//drawJoint(0.5, 0.0, 0.0);
	//drawJoint(0.0, 0.0, 0.0, 2); // The first joint will be blue
	joints.push([0.0, 0.0, 0.0, [0.0, 0.0, 1.0, 1.0]]);
	joints.push([1.0, 0.0, 0.0, [0.0, 1.0, 0.0, 1.0]]);
	
	// Origin Coordinate Frame:
	/*
	links.push([0.0, 0.0, 0.0, 1.5, 0.0, 0.0, 0.006, 1]);
	links.push([0.0, 0.0, 0.0, 0.0, 1.5, 0.0, 0.006, 2]);
	links.push([0.0, 0.0, 0.0, 0.0, 0.0, 1.5, 0.006, 3]);
	*/
	
	links.push([0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.01, 0]);
	
	drawAllJoints(joints);
	drawAllLinks(links);
	// drawLink(0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.01, 0);
	
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );
    
    var cBuffer = gl.createBuffer();
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
    thetaLoc = gl.getUniformLocation(program, "theta"); 
	modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
	projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
	
	projectionMatrix = ortho(left, right, bottom, ytop, near, far);
	gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    	
	document.getElementById("cubeAngleX").onchange = function() {
		//theta = document.getElementById("cubeAngle").value;
		//axis = xAxis;
		theta[axis] = event.srcElement.value; //document.getElementById("cubeAngleX").value;
		render();
	};

	document.getElementById("cubeAngleY").onchange = function() {
        //theta = document.getElementById("cubeAngle").value;
        //axis = yAxis;
        theta[axis] = event.srcElement.value; document.getElementById("cubeAngleY").value;
        render();
    };

    document.getElementById("cubeAngleZ").onchange = function() {
        //theta = document.getElementById("cubeAngle").value;
        //axis = zAxis;
		// We have to negate the Z-Axis since the camera looks in the -Z direction:
        theta[axis] = -1.0 * event.srcElement.value; //document.getElementById("cubeAngleZ").value;
        render();
    };
	
	// Joint 1 rotates around the X-Axis; Joint 2 rotates around the Y-Axis:
	rotationAxes.push([1, 0, 0]);
	rotationAxes.push([0, 1, 0]);
	
	document.getElementById("rotJoint1").onchange = function() {
		axis = xAxis;
		theta[axis] = event.srcElement.value;
		render();
	};
	
	document.getElementById("rotJoint2").onchange = function() {
		axis = xAxis;
		theta[axis] = event.srcElement.value;
		render();
	}; 

	document.getElementById("newJoint").onclick = function() {
		//NumVertices = 0;
		addJointCallback();
		drawAllJoints(joints);
		drawAllLinks(links);
		
		gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, vBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );
		
		console.log("after the newJointButton was clicked, before rendering, NumVertices is: " + NumVertices);
		console.log("Before rendering, joints.length is: " + joints.length);
		render();
	};
	
	render();


	/** END REMOVE THIS SECTION **/
    /* 
	if(hasLoaded === 0) {
		//console.log("DEBUG ONLY - I have rendered!");
		render();
		hasLoaded = 1;
	} // End if
	*/
    //render();
} // End function init()

/*** ADDITIONAL MATRIX/VECTOR FUNCTIONS ***/

/*
 * scaleMatrix() multiplies all elements in a matrix by a scalar.
 *
 * Inputs: scale (integer scalar)
 *         mat (the matrix to scale)
 * Returns: scaled matrix
 *
 * Verified/Tested 10/21
 */   
function scaleMatrix(scale, mat) {

	var scaledMat = mat3();
	
	for(var i = 0; i < mat.length; i++) {
		for(var j = 0; j < mat[0].length; j++) {
			scaledMat[i][j] = mat[i][j] * 3;
		} // End for
	} // End for

	return scaledMat;
} // End function scaleMatrix()

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
	var I3 = mat3(1, 0, 0,
	              0, 1, 0,
                  0, 0, 1);

	var subMatrix = add(add(I3, scaleMatrix(Math.sin(theta), kx)),
	                    mult(scaleMatrix((1-Math.cos(theta)), kx), kx));

	return subMatrix;

	

} // End function rot3D()


/*** End Section Kinematics Functions ***/

/*** Drawing Functions ***/

// This function draws the X-Axis:
function drawXAxis() {

} // End function drawXAxis()

function drawYAxis() {

} // End function drawYAxis()

function drawZAxis() {

} // End function drawZAxis()

// This function takes a list of all the links to draw and draws all of them:
function drawAllLinks(listOfLinks) {
	for(var i = 0; i < listOfLinks.length; i++) {
		drawLink(listOfLinks[i][0], listOfLinks[i][1], listOfLinks[i][2], listOfLinks[i][3], 
		         listOfLinks[i][4], listOfLinks[i][5], listOfLinks[i][6], listOfLinks[i][7]);
	} // End for
} // End function drawAllLinks()

// This function takes a list of joint parameters and draws all of them:
function drawAllJoints(listOfJoints) {
	for(var i = 0; i < listOfJoints.length; i++) {
		drawJoint(listOfJoints[i][0], listOfJoints[i][1], listOfJoints[i][2], listOfJoints[i][3]);
	} // End for
} // End function drawAllJoints()

/*
 * This function draws a joint.  A joint is represented as a cube.  The color is represented as a 
 * vec4 RGB vector.
 */
function drawJoint(jointX, jointY, jointZ, color) {

	console.log("Now calling drawJoint() at:");
	console.log("jointX: " + jointX);
	console.log("jointY: " + jointY);
	console.log("jointZ: " + jointZ);
	
	var scaledJointX = jointX / 4.0;
	var scaledJointY = jointY / 4.0;
	var scaledJointZ = jointZ / 4.0;
	
	// The vertices of the joint:
	var vertices = [
		vec3(scaledJointX - 0.04, scaledJointY - 0.04, scaledJointZ + 0.04),
		vec3(scaledJointX - 0.04, scaledJointY + 0.04, scaledJointZ + 0.04),
        vec3(scaledJointX + 0.04, scaledJointY + 0.04, scaledJointZ + 0.04),
        vec3(scaledJointX + 0.04, scaledJointY - 0.04, scaledJointZ + 0.04),
        vec3(scaledJointX - 0.04, scaledJointY - 0.04, scaledJointZ - 0.04),
        vec3(scaledJointX - 0.04, scaledJointY + 0.04, scaledJointZ - 0.04),
        vec3(scaledJointX + 0.04, scaledJointY + 0.04, scaledJointZ - 0.04),
        vec3(scaledJointX + 0.04, scaledJointY - 0.04, scaledJointZ - 0.04)
	];

	console.log("vertices is: " + vertices);

	// a-b-c-a-c-d
	var verticesOfJoints = [1, 0, 3, 1, 3, 2,
	                        2, 3, 7, 2, 7, 6,
							3, 0, 4, 3, 4, 7, 
							6, 5, 1, 6, 1, 2,
							4, 5, 6, 4, 6, 7,  
							5, 4, 0, 5, 0, 1 ];

	// The joint will be a solid cube of red:
	var jointColors = [
					vec4(1.0, 0.0, 0.0, 1.0), // Red
					vec4(0.0, 1.0, 0.0, 1.0), // Green
					vec4(0.0, 0.0, 1.0, 1.0) // Blue
					];

	// Add all vertices to be rendered:
	for(var i = 0; i < verticesOfJoints.length; i++) {
		points.push(vertices[verticesOfJoints[i]]);
		//colors.push(jointColors[color]);
		colors.push(color);
	} // End for 
														
	// For each joint, there are 36 vertices to render:
	NumVertices += 36;	
	//NumVertices = 36;

	/*
	jointside(1, 0, 3, 2);
	jointside(2, 3, 7, 6);
	jointside(3, 0, 4, 7);
	jointside(6, 5, 1, 2);
	jointside(4, 5, 6, 7);
	jointside(5, 4, 0, 1);
	*/
} // End function drawJoint()

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
	//NumVertices = 36;
	
} // End function drawLink()

function colorCube()
{
    quad( 1, 0, 3, 2 );
    quad( 2, 3, 7, 6 );
    quad( 3, 0, 4, 7 );
    quad( 6, 5, 1, 2 );
    quad( 4, 5, 6, 7 );
    quad( 5, 4, 0, 1 );
}


function quad(a, b, c, d) 
{
    var vertices = [
        vec3( -0.1, -0.1,  0.1 ),
        vec3( -0.1,  0.1,  0.1 ),
        vec3(  0.1,  0.1,  0.1 ),
        vec3(  0.1, -0.1,  0.1 ),
        vec3( -0.1, -0.1, -0.1 ),
        vec3( -0.1,  0.1, -0.1 ),
        vec3(  0.1,  0.1, -0.1 ),
        vec3(  0.1, -0.1, -0.1 )
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
        colors.push( vertexColors[indices[i]] );
    } // End for
}

// Tests for joint 1 and joint 2 with 1 link betweek:
function drawJoint1() {
	var s = mat4(1, 0, 0, 0, 
	             0, 1, 0, 0,
				 0, 0, 1, 0,
				 0, 0, 0, 1);
	var instanceMatrix = mult(translate(0.0, 0.0, 0.0), s);
	var t = mult(modelViewMatrix, instanceMatrix);
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
	gl.drawArrays(gl.TRIANGLES, 0, 36); //NumVertices);
} // End function drawJoint1()

function drawLink1() {

} // End function drawLink1()

function drawJoint2() {
	var s = mat4(1, 0, 0, 0, 
	             0, 1, 0, 0,
				 0, 0, 1, 0,
				 0, 0, 0, 1);
	var instanceMatrix = mult(translate(1.0, 0.0, 0.0), s);
	var t = mult(modelViewMatrix, instanceMatrix);
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
	gl.drawArrays(gl.TRIANGLES, 37, 72);
} // End function drawJoint2()



// Rendering function:
function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //gl.uniform3fv(thetaLoc, theta);

	// We want the camera to look from the point (1, 1, 1):
	modelViewMatrix = lookAt([0.1, 0.1, 0.1], [0.0, 0.0, 0.0], [0.0, 0.0, 1.0]);
	
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.drawArrays( gl.TRIANGLES, 72, 36); //NumVertices );
	
	requestAnimFrame(render);

} // End function render()

/*** END SECTION DRAWING FUNCTIONS ***/
