import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;







void main() {
  runApp(SwiftRideApp());
}

class SwiftRideApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SwiftRide',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        scaffoldBackgroundColor: Colors.white,
        fontFamily: 'Roboto',
      ),
      home: SplashScreen(),
     
    );
  }
}

// ==================== MODELS ====================
class Vehicle {
  final String id;
  final String name;
  final String type;
  final String number;
  final String driverName;
  final double lat;
  final double lng;
  final double rating;
  final String eta; // ✅ add this

  Vehicle({
    required this.id,
    required this.name,
    required this.type,
    required this.number,
    required this.driverName,
    required this.lat,
    required this.lng,
    this.rating = 5.0,
    this.eta = '5 min', // ✅ default value
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      type: json['type'] ?? '',
      number: json['number'] ?? '',
      driverName: json['driverName'] ?? '',
      lat: (json['lat'] ?? 0).toDouble(),
      lng: (json['lng'] ?? 0).toDouble(),
      rating: (json['rating'] ?? 5).toDouble(),
      eta: json['eta'] ?? '5 min', // ✅ from API or default
      
    );
  }
}


// ==================== MOCK DATA ====================

// ==================== SPLASH SCREEN ====================
class SplashScreen extends StatefulWidget {
  @override
  _SplashScreenState createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(seconds: 2),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _scaleAnimation = Tween<double>(begin: 0.5, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.bounceOut),
    );
    
    _controller.forward();

    Timer(Duration(seconds: 3), () {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => SignupPage()),
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF3B82F6), Color(0xFF93C5FD)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'SwiftRide',
                        style: TextStyle(
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 4,
                        ),
                      ),
                      SizedBox(height: 10),
                      Text(
                        'Your Journey, Our Priority',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.white70,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

// ==================== COMMON WIDGETS ====================
class CustomInputField extends StatelessWidget {
  final String label;
  final IconData icon;
  final TextEditingController controller;
  final bool isPassword;
  final VoidCallback? onTogglePassword;
  final bool obscureText;

  CustomInputField({
    required this.label,
    required this.icon,
    required this.controller,
    this.isPassword = false,
    this.onTogglePassword,
    this.obscureText = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 5),
          )
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: Color(0xFF3B82F6)),
          labelText: label,
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(vertical: 18, horizontal: 20),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText ? Icons.visibility : Icons.visibility_off,
                    color: Color(0xFF3B82F6),
                  ),
                  onPressed: onTogglePassword,
                )
              : null,
        ),
      ),
    );
  }
}

class GradientButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;
  final List<Color>? colors;

  GradientButton({
    required this.text,
    required this.onPressed,
    this.colors,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 55,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors ?? [Color(0xFF3B82F6), Color(0xFF60A5FA)],
        ),
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: (colors?[0] ?? Color(0xFF3B82F6)).withOpacity(0.3),
            blurRadius: 20,
            offset: Offset(0, 10),
          )
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(15),
          onTap: onPressed,
          child: Center(
            child: Text(
              text,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ==================== SIGNUP PAGE ====================
class SignupPage extends StatefulWidget {
  @override
  _SignupPageState createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  String role = 'passenger'; // default role
  bool _obscurePassword = true;

  Future<void> handleSignup() async {
    try {
      final response = await http.post(
        Uri.parse('https://project1-13.onrender.com/signup'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "email": emailController.text,
          "password": passwordController.text,
          "role": role,
        }),
      );

      final data = jsonDecode(response.body);

      if (data['status'] == 'success') {
        _showSnackBar("Signup successful! Please login.");
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => LoginPage()),
        );
      } else {
        _showSnackBar(data['message'], isError: true);
      }
    } catch (e) {
      _showSnackBar("Network error: $e", isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required IconData icon,
    required TextEditingController controller,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onTogglePassword,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: Color(0xFF3B82F6)),
          labelText: label,
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(vertical: 18, horizontal: 20),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText ? Icons.visibility : Icons.visibility_off,
                    color: Color(0xFF3B82F6),
                  ),
                  onPressed: onTogglePassword,
                )
              : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF93C5FD), Colors.white],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 60),
                Text(
                  'Create Account',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF3B82F6),
                  ),
                ),
                SizedBox(height: 10),
                Text(
                  'Sign up to start your SwiftRide journey',
                  style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                ),
                SizedBox(height: 50),

                // Email Field
                _buildInputField(
                  label: 'Email',
                  icon: Icons.email,
                  controller: emailController,
                ),

                // Password Field
                _buildInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                ),

                // Role Dropdown
                Container(
                  margin: EdgeInsets.only(bottom: 20),
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 10,
                        offset: Offset(0, 5),
                      ),
                    ],
                  ),
                  child: DropdownButtonFormField<String>(
                    value: role,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      labelText: "Select Role",
                      prefixIcon: Icon(Icons.person, color: Color(0xFF3B82F6)),
                    ),
                    items: [
                      DropdownMenuItem(child: Text("Passenger"), value: "passenger"),
                      DropdownMenuItem(child: Text("Driver"), value: "driver"),
                    ],
                    onChanged: (val) {
                      setState(() => role = val!);
                    },
                  ),
                ),

                SizedBox(height: 30),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: handleSignup,
                    child: Text('Create Account'),
                    style: ElevatedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 15),
                      textStyle: TextStyle(fontSize: 18),
                      backgroundColor: Color(0xFF3B82F6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                    ),
                  ),
                ),

                SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => LoginPage()),
                      );
                    },
                    child: Text(
                      "Already have an account? Login",
                      style: TextStyle(
                        color: Color(0xFF3B82F6),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ==================== LOGIN PAGE ====================






class LoginPage extends StatefulWidget {
  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

 Future<void> handleLogin() async {
  if (emailController.text.isEmpty || passwordController.text.isEmpty) {
    _showSnackBar('Please fill in all fields', isError: true);
    return;
  }

  final url = Uri.parse('https://project1-13.onrender.com/login');

  try {
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "email": emailController.text,
        "password": passwordController.text,
      }),
    );

    print("Response status code: ${response.statusCode}");
    print("Response body: ${response.body}");

    final data = jsonDecode(response.body);

    if (data['status'] == 'success') {
      // ✅ Token ko SharedPreferences me save karo
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']); // yahi token hai backend se
      await prefs.setBool('isLoggedIn', true);

      _showSnackBar('Login successful!');

      await Future.delayed(Duration(seconds: 1));
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => RoleSelectionPage()),
      );
    } else {
      _showSnackBar(data['message'], isError: true);
    }
  } catch (e) {
    _showSnackBar('Network error: $e', isError: true);
  }
}


  Widget _buildInputField({
    required String label,
    required IconData icon,
    required TextEditingController controller,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onTogglePassword,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: Color(0xFF3B82F6)),
          labelText: label,
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(vertical: 18, horizontal: 20),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText ? Icons.visibility : Icons.visibility_off,
                    color: Color(0xFF3B82F6),
                  ),
                  onPressed: onTogglePassword,
                )
              : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF93C5FD), Colors.white],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 60),
                Text(
                  'Welcome Back!',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF3B82F6),
                  ),
                ),
                SizedBox(height: 10),
                Text(
                  'Login to continue using SwiftRide',
                  style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                ),
                SizedBox(height: 50),

                // Email Field
                _buildInputField(
                  label: 'Email',
                  icon: Icons.email,
                  controller: emailController,
                ),

                // Password Field
                _buildInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                ),

                SizedBox(height: 30),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: handleLogin,
                    child: Text('Login to SwiftRide'),
                    style: ElevatedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 15),
                      textStyle: TextStyle(fontSize: 18),
                      backgroundColor: Color(0xFF3B82F6),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                    ),
                  ),
                ),

                SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => SignupPage()),
                      );
                    },
                    child: Text(
                      "Don't have an account? Sign up",
                      style: TextStyle(
                        color: Color(0xFF3B82F6),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ==================== ROLE SELECTION PAGE ====================

class RoleSelectionPage extends StatelessWidget {
  Widget _roleCard({
    required String title,
    required String subtitle,
    required String emoji,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: EdgeInsets.only(bottom: 25),
        padding: EdgeInsets.all(30),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [color, color.withOpacity(0.8)]),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.3),
              blurRadius: 20,
              offset: Offset(0, 10),
            )
          ],
        ),
        child: Column(
          children: [
            Text(
              emoji,
              style: TextStyle(fontSize: 50),
            ),
            SizedBox(height: 15),
            Text(
              title,
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 5),
            Text(
              subtitle,
              style: TextStyle(
                color: Colors.white70,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Choose Your Role'),
        backgroundColor: Color(0xFF3B82F6),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFF3F4F6), Color(0xFFE5E7EB)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [

                // PASSENGER
                _roleCard(
                  title: 'Passenger Panel',
                  subtitle: 'Student / Worker / Commuter',
                  emoji: '🚶',
                  color: Color(0xFF10B981),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) =>  BusListPage()),
                    );
                  },
                ),

                // DRIVER  🔥 THIS WAS MISSING
                _roleCard(
                  title: 'Driver Panel',
                  subtitle: 'Manage Trips & Bus Tracking',
                  emoji: '🚌',
                  color: Color(0xFF3B82F6),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => DriverPanel()),
                    );
                  },
                ),

              ],
            ),
          ),
        ),
      ),
    );
  }
}


// ==================== DRIVER PANEL ====================
// ---------------- DRIVER PANEL ----------------
class DriverPanel extends StatefulWidget {
  @override
  _DriverPanelState createState() => _DriverPanelState();
}

class _DriverPanelState extends State<DriverPanel> {
  // Trip controllers
  final TextEditingController fromController = TextEditingController();
  final TextEditingController toController = TextEditingController();

  // Driver + Bus controllers
  final TextEditingController driverNameController = TextEditingController();
  final TextEditingController busNumberController = TextEditingController();
  final TextEditingController routeController = TextEditingController();
  final TextEditingController stopsController = TextEditingController();

  bool isTripActive = false;

  // Token (from login)
  String token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTE5ZWFlNTI2MWQ1YjVjNzBkYTRlZWQiLCJlbWFpbCI6InNoaXZhMSIsInJvbGUiOiJkcml2ZXIiLCJpYXQiOjE3NjMzOTAyNDAsImV4cCI6MTc2MzQ3NjY0MH0.92-p_AVn1pLA2obNulC8oSl3Fio21lxXHosZ-HWX-_4"; // <-- replace with actual token after login

  // 🔹 Trip start
  void startTrip() {
    if (fromController.text.isEmpty ||
        toController.text.isEmpty ||
        driverNameController.text.isEmpty ||
        busNumberController.text.isEmpty) {
      _showSnackBar("Please fill all driver & trip details!", isError: true);
      return;
    }

    setState(() => isTripActive = true);

    _showSnackBar("Trip Started! Live tracking ON");

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DriverMapScreen(
          fromLocation: fromController.text,
          toLocation: toController.text,
          driverName: driverNameController.text,
          busNumber: busNumberController.text,
          token: token, // pass token
          onTripEnd: () {
            setState(() {
              isTripActive = false;
              fromController.clear();
              toController.clear();
            });
          },
        ),
      ),
    );
  }

  // 🔹 ADD / UPDATE BUS INFO to BACKEND
  Future<void> addBus() async {
    final url = Uri.parse('https://project1-13.onrender.com/vehicles');

    try {
      final response = await http.post(
        url,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: json.encode({
          "name": driverNameController.text, // ← Driver Name
          "type": "Bus",
          "number": busNumberController.text,
          "route": routeController.text,
          "stops": stopsController.text
              .split(",")
              .map((e) => e.trim())
              .toList(),
          "currentLocation": {
            "lat": 19.0760,
            "lng": 72.8777,
          }
        }),
      );

      if (response.statusCode == 201) {
        _showSnackBar("Bus Added Successfully");
        busNumberController.clear();
        routeController.clear();
        stopsController.clear();
      } else {
        _showSnackBar("Failed: ${response.body}", isError: true);
      }
    } catch (e) {
      _showSnackBar("Error: $e", isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Driver Dashboard"),
        backgroundColor: Color(0xFF3B82F6),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [
            // DRIVER INFO
            Container(
              padding: EdgeInsets.all(20),
              decoration: _boxDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  sectionTitle("🧑‍✈️ Driver Info"),
                  CustomInputField(
                    label: "Driver Name",
                    icon: Icons.person,
                    controller: driverNameController,
                  ),
                  CustomInputField(
                    label: "Bus Number",
                    icon: Icons.directions_bus,
                    controller: busNumberController,
                  ),
                ],
              ),
            ),

            SizedBox(height: 20),

            // TRIP DETAILS
            Container(
              padding: EdgeInsets.all(20),
              decoration: _boxDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  sectionTitle("📍 Trip Details"),
                  CustomInputField(
                    label: "From",
                    icon: Icons.location_searching_rounded,
                    controller: fromController,
                  ),
                  CustomInputField(
                    label: "To",
                    icon: Icons.location_on,
                    controller: toController,
                  ),
                  GradientButton(
                    text: isTripActive ? "Trip Running..." : "Start Trip",
                    onPressed: isTripActive ? () {} : startTrip,
                  ),
                ],
              ),
            ),

            SizedBox(height: 20),

            // ADD BUS SECTION
            Container(
              padding: EdgeInsets.all(20),
              decoration: _boxDecoration(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  sectionTitle("🚌 Add / Update Bus"),
                  CustomInputField(
                    label: "Route",
                    icon: Icons.alt_route,
                    controller: routeController,
                  ),
                  CustomInputField(
                    label: "Stops (comma separated)",
                    icon: Icons.location_city,
                    controller: stopsController,
                  ),
                  GradientButton(
                    text: "Save Bus Info",
                    onPressed: addBus,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  BoxDecoration _boxDecoration() {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(15),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.05),
          blurRadius: 15,
          offset: Offset(0, 5),
        )
      ],
    );
  }

  Widget sectionTitle(String title) {
    return Padding(
      padding: EdgeInsets.only(bottom: 10),
      child: Text(
        title,
        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
      ),
    );
  }
}

// ---------------- DRIVER MAP SCREEN ----------------


class DriverMapScreen extends StatefulWidget {
  final String fromLocation;
  final String toLocation;
  final String driverName;
  final String busNumber;
  final String token;
  final VoidCallback onTripEnd;

  DriverMapScreen({
    required this.fromLocation,
    required this.toLocation,
    required this.driverName,
    required this.busNumber,
    required this.token,
    required this.onTripEnd,
  });

  @override
  _DriverMapScreenState createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen> {
  LatLng currentPosition = LatLng(19.0760, 72.8777);
  Timer? updateTimer;
  final MapController mapController = MapController();

  @override
  void initState() {
    super.initState();
    startLiveLocationTracking();
  }

  @override
  void dispose() {
    updateTimer?.cancel();
    super.dispose();
  }

  // ------------------ LIVE LOCATION TRACKING -------------------
  void startLiveLocationTracking() async {
    Position? pos = await getLocation();
    if (pos != null) {
      setState(() {
        currentPosition = LatLng(pos.latitude, pos.longitude);
      });
    }

    updateTimer = Timer.periodic(Duration(seconds: 3), (_) async {
      await sendLocationToBackend();
      mapController.move(currentPosition, 16);
    });
  }

  // ------------------ LOCATION FETCH -------------------
  Future<Position?> getLocation() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      await Geolocator.openLocationSettings();
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high);
  }

  // ------------------ SEND LOCATION TO BACKEND -------------------
  Future<void> sendLocationToBackend() async {
    try {
      Position? pos = await getLocation();
      if (pos == null) return;

      setState(() {
        currentPosition = LatLng(pos.latitude, pos.longitude);
      });

      final url = Uri.parse(
          "https://project1-13.onrender.com/vehicles/${widget.busNumber}/location");

      final response = await http.put(
        url,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ${widget.token}",
        },
        body: jsonEncode({
          "lat": pos.latitude,
          "lng": pos.longitude,
        }),
      );

      print("Location Updated: ${response.statusCode}");
    } catch (e) {
      print("Location update error: $e");
    }
  }

  // ------------------ GPS TEST FUNCTION -------------------
  Future<void> testGPS() async {
    Position? pos = await getLocation();
    if (pos != null) {
      print("GPS Test → Latitude: ${pos.latitude}, Longitude: ${pos.longitude}");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("GPS Working: ${pos.latitude}, ${pos.longitude}")),
      );
    } else {
      print("GPS Test → Location not available");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("GPS Not Available")),
      );
    }
  }

  // ------------------ END TRIP -------------------
  void endTrip() {
    updateTimer?.cancel();
    widget.onTripEnd();
    Navigator.pop(context);
  }

  // ------------------ UI -------------------
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Driver Live Tracking"),
        backgroundColor: Colors.blue,
        actions: [
          TextButton(
            onPressed: endTrip,
            child: Text("End Trip", style: TextStyle(color: Colors.white)),
          )
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: mapController,
            options: MapOptions(
              initialCenter: currentPosition,
              initialZoom: 16,
            ),
            children: [
              TileLayer(
                urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                userAgentPackageName: 'com.example.app',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: currentPosition,
                    width: 60,
                    height: 60,
                    child: Column(
                      children: [
                        Icon(Icons.directions_bus, size: 40, color: Colors.green),
                        Text(
                          widget.driverName,
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.bold),
                        )
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            bottom: 20,
            right: 20,
            child: FloatingActionButton(
              onPressed: testGPS,
              child: Icon(Icons.gps_fixed),
              tooltip: "Test GPS",
            ),
          ),
        ],
      ),
    );
  }
}



// ======= Passenger Panel =======




// ======= Main App =======

// Simple vehicle model





// ===================== PASSENGER PANEL =====================
class PassengerPanel extends StatefulWidget {
  final String vehicleId;

  const PassengerPanel({super.key, required this.vehicleId});

  @override
  State<PassengerPanel> createState() => _PassengerPanelState();
}

class _PassengerPanelState extends State<PassengerPanel> {
  final MapController mapController = MapController();
  LatLng? busLocation;
  Timer? liveTimer;

  @override
  void initState() {
    super.initState();
    fetchBusLocation(); // first fetch
    startLiveTracking();
  }

  @override
  void dispose() {
    liveTimer?.cancel();
    super.dispose();
  }

  // ------------------ FETCH BUS LOCATION ------------------
  Future<void> fetchBusLocation() async {
    try {
      final res = await http.get(
        Uri.parse("https://project1-13.onrender.com/vehicles/${widget.vehicleId}"),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data["currentLocation"] != null &&
            data["currentLocation"]["lat"] != null &&
            data["currentLocation"]["lng"] != null) {
          final newLocation = LatLng(
            data["currentLocation"]["lat"].toDouble(),
            data["currentLocation"]["lng"].toDouble(),
          );
          setState(() {
            busLocation = newLocation;
          });
          mapController.move(newLocation, 16);
          debugPrint("Bus Location Updated: $busLocation");
        }
      } else {
        debugPrint("Bus fetch failed with status: ${res.statusCode}");
      }
    } catch (e) {
      debugPrint("Bus location fetch error: $e");
    }
  }

  void startLiveTracking() {
    liveTimer?.cancel();
    liveTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      await fetchBusLocation();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Passenger Panel"),
        backgroundColor: Colors.green,
      ),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              mapController: mapController,
              options: MapOptions(
                
              ),
              children: [
                TileLayer(
  urlTemplate: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  subdomains: const ['a', 'b', 'c'],
),

                if (busLocation != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: busLocation!,
                        width: 60,
                        height: 60,
                        child: const Icon(
                          Icons.directions_bus,
                          size: 40,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          if (busLocation != null)
            Container(
              padding: const EdgeInsets.all(10),
              color: Colors.black12,
              child: Text(
                "Bus live location: ${busLocation!.latitude.toStringAsFixed(5)}, "
                "${busLocation!.longitude.toStringAsFixed(5)}",
                style: const TextStyle(fontSize: 15),
              ),
            ),
        ],
      ),
    );
  }
}

// ===================== BUS LIST SCREEN =====================
class BusListPage extends StatefulWidget {
  const BusListPage({super.key});

  @override
  _BusListPageState createState() => _BusListPageState();
}

class _BusListPageState extends State<BusListPage> {
  List buses = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    fetchBuses();
  }

  Future<void> fetchBuses() async {
    try {
      final res = await http.get(
        Uri.parse("https://project1-13.onrender.com/vehicles"),
      );

      if (res.statusCode == 200) {
        setState(() {
          buses = jsonDecode(res.body);
          loading = false;
        });
        debugPrint("Buses fetched: $buses");
      } else {
        debugPrint("Bus list fetch failed with status: ${res.statusCode}");
      }
    } catch (e) {
      debugPrint("Bus fetch error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Select Bus"),
        backgroundColor: Colors.green,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: buses.length,
              itemBuilder: (context, index) {
                final bus = buses[index];
                return ListTile(
                  leading: const Icon(Icons.directions_bus, color: Colors.green),
                  title: Text(bus["number"] ?? bus["name"] ?? ""),
                  subtitle: Text(bus["type"] ?? ""),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PassengerPanel(vehicleId: bus["_id"]),
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}
