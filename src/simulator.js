/*
 * simulator.js - The dynamic Javascript code for the Robotic Arm Simulator.
 *
 * Bryant Pong
 * ECSE-4750
 * 10/18/14
 *
 * Last Updated: 11/4/14 - 5:36 PM
 */ 

var canvas;
var gl;

// Remove when implementing arm graphics
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
var theta = [ 0, 0, 0 ];

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
 * This function allows new HTML elements to be added to the simulator webpage.
 * This function is used to create new slider elements when a new robot arm
 * joint is created.
 *
 * TESTED/VERTIFIED
 */
function addHTMLElement(type) {

	// We will be using the DOM's createElement() function: 
	var element = document.createElement("input");

	// Set the attributes of this new input element:
	element.setAttribute("type", type);
	element.setAttribute("value", type);
	element.setAttribute("name", type);

	// We need to get a generic item in the DOM to append the new element:
	var genericItem = document.getElementById("nonexistent");
	
	// Add the new input element into the page:
	genericItem.appendChild(element); 
} // End function addHTMLElement()


/*
 * Onload - This function is executed when the browser is opened.  Equivalent
 * to int main() in C.
 */
window.onload = function init()
{

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    //colorCube();
 	drawJoint(0.5, 0.0, 0.0);
	drawJoint(0.0, 0.0, 0.0);

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
    	
	document.getElementById("cubeAngleX").onchange = function() {
		//theta = document.getElementById("cubeAngle").value;
		axis = xAxis;
		theta[axis] = document.getElementById("cubeAngleX").value;
		render();
	};

	document.getElementById("cubeAngleY").onchange = function() {
        //theta = document.getElementById("cubeAngle").value;
        axis = yAxis;
        theta[axis] = document.getElementById("cubeAngleY").value;
        render();
    };

    document.getElementById("cubeAngleZ").onchange = function() {
        //theta = document.getElementById("cubeAngle").value;
        axis = zAxis;
        theta[axis] = document.getElementById("cubeAngleZ").value;
        render();
    };


	/** END REMOVE THIS SECTION **/
        
	if(hasLoaded === 0) {
		console.log("DEBUG ONLY - I have rendered!");
		points.push(originFrameX);
		colors.push([0.0, 0.0, 0.0, 1.0]);
		render();
		hasLoaded = 1;
	} // End if
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

// This function draws a joint.  A joint is represented as a cube.
function drawJoint(jointX, jointY, jointZ) {

	console.log("Now calling drawJoint() at:");
	console.log("jointX: " + jointX);
	console.log("jointY: " + jointY);
	console.log("jointZ: " + jointZ);
	// The vertices of the joint:
	var vertices = [
		vec3(jointX	- 0.04, jointY - 0.04, jointZ + 0.04),
		vec3(jointX - 0.04, jointY + 0.04, jointZ + 0.04),
        vec3(jointX + 0.04, jointY + 0.04, jointZ + 0.04),
        vec3(jointX + 0.04, jointY - 0.04, jointZ + 0.04),
        vec3(jointX - 0.04, jointY - 0.04, jointZ - 0.04),
        vec3(jointX - 0.04, jointY + 0.04, jointZ - 0.04),
        vec3(jointX + 0.04, jointY + 0.04, jointZ - 0.04),
        vec3(jointX + 0.04, jointY - 0.04, jointZ - 0.04)
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
	var jointColor = vec4(1.0, 0.0, 0.0, 1.0);

	// Add all vertices to be rendered:
	for(var i = 0; i < verticesOfJoints.length; i++) {
		points.push(vertices[verticesOfJoints[i]]);
		colors.push(jointColor);
	} // End for 
														

	// For each joint, there are 36 vertices to render:
	NumVertices += 36;	

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
function drawLink() {

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
    
        // for solid colored faces use 
        // colors.push(vertexColors[a]);
        
    }
}

// Rendering function:
function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //theta[axis] += 2.0;
    gl.uniform3fv(thetaLoc, theta);

	// We want the camera to look from the point (1, 1, 1):
	modelViewMatrix = lookAt([0.1, 0.1, 0.1], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
	projectionMatrix = ortho(left, right, bottom, ytop, near, far);
	
	// The modelViewMatrix (in column-major format) 
	/*modelViewMatrix = mat4(1.0, 0, 0, 0, 
	                       	   0, 1.0, 0, 0,
   							   0, 0, 1.0, 0,
							   0, 0, -0.3, 1.0);*/

	gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
	gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
	
    gl.drawArrays( gl.TRIANGLES, 0, NumVertices );

    //requestAnimFrame( render );
} // End function render()

/*** END SECTION DRAWING FUNCTIONS ***/
