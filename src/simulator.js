/*
 * simulator.js - The dynamic Javascript code for the Robotic Arm Simulator.
 *
 * Bryant Pong
 * ECSE-4750
 * 10/18/14
 *
 * Last Updated: 10/21/14 - 6:35 PM
 */ 

var canvas;
var gl;

// Remove when implementing arm graphics
var NumVertices  = 36;

var points = [];
var colors = [];

// This array holds the Cartesian locations of all the rotational joints:
var joints = [];

var xAxis = 0;
var yAxis = 1;
var zAxis = 2;

var axis = 0;
var theta = [ 0, 0, 0 ];

var thetaLoc;

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

    colorCube();

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

    thetaLoc = gl.getUniformLocation(program, "theta"); 
    
    //event listeners for buttons
    
    document.getElementById( "xButton" ).onclick = function () {
        axis = xAxis;
    };
    document.getElementById( "yButton" ).onclick = function () {
        axis = yAxis;
    };
    document.getElementById( "zButton" ).onclick = function () {
        axis = zAxis;
    };
        
    render();
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
        colors.push( vertexColors[indices[i]] );
    
        // for solid colored faces use 
        // colors.push(vertexColors[a]);
        
    }
}

// Rendering function:
function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    theta[axis] += 2.0;
    gl.uniform3fv(thetaLoc, theta);

    gl.drawArrays( gl.TRIANGLES, 0, NumVertices );

    requestAnimFrame( render );
} // End function render()

