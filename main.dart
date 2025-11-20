import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';

import 'package:socket_io_client/socket_io_client.dart' as IO;
 // ye already hai, lekin confirm kar le
import 'package:latlong2/latlong.dart' as latlong;  // ye line add kar de

  // ← YE ADD KAR

     // ← YE ADD KAR

void main() => runApp(const SwiftRideApp());

class SwiftRideApp extends StatelessWidget {
  const SwiftRideApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SwiftRide',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Poppins',
        useMaterial3: true,
      ),
      home: const SplashScreen(),
    );
  }
}

// ==================== SPLASH SCREEN ====================
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
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
        duration: const Duration(seconds: 2), vsync: this);
    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _scaleAnimation = Tween<double>(begin: 0.5, end: 1).animate(
        CurvedAnimation(parent: _controller, curve: Curves.bounceOut));
    _controller.forward();

    Timer(const Duration(seconds: 3), () {
      Navigator.pushReplacement(
          context, MaterialPageRoute(builder: (_) => const LoginPage()));
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
        decoration: const BoxDecoration(
          gradient: LinearGradient(
              colors: [Color(0xFF3B82F6), Color(0xFF93C5FD)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight),
        ),
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.directions_bus_filled, size: 100, color: Colors.white),
                      SizedBox(height: 20),
                      Text('SwiftRide',
                          style: TextStyle(
                              fontSize: 48,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 4)),
                      SizedBox(height: 10),
                      Text('Your Journey, Our Priority',
                          style: TextStyle(fontSize: 16, color: Colors.white70)),
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

// ==================== CUSTOM WIDGETS ====================
class CustomInputField extends StatelessWidget {
  final String label;
  final IconData icon;
  final TextEditingController controller;
  final bool isPassword;
  final VoidCallback? onTogglePassword;
  final bool obscureText;

  const CustomInputField({
    required this.label,
    required this.icon,
    required this.controller,
    this.isPassword = false,
    this.onTogglePassword,
    this.obscureText = false,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 5))
        ],
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: const Color(0xFF3B82F6)),
          labelText: label,
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(obscureText ? Icons.visibility : Icons.visibility_off,
                      color: const Color(0xFF3B82F6)),
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
  const GradientButton({required this.text, required this.onPressed, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 55,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)]),
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
              color: const Color(0xFF3B82F6).withOpacity(0.4),
              blurRadius: 20,
              offset: const Offset(0, 10))
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(15),
          onTap: onPressed,
          child: Center(
              child: Text(text,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold))),
        ),
      ),
    );
  }
}

// ==================== LOGIN & SIGNUP ====================
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green));
  }

  Future<void> handleLogin() async {
    if (emailController.text.isEmpty || passwordController.text.isEmpty) {
      _showSnackBar('Please fill all fields', isError: true);
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('https://project1-13.onrender.com/api/login'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "email": emailController.text.trim(),
          "password": passwordController.text,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', data['token']);
        await prefs.setString('user_role', data['user']['role']);
        await prefs.setString('user_name', data['user']['name'] ?? data['user']['email']);

        _showSnackBar('Welcome ${data['user']['name'] ?? 'User'}!');
        Navigator.pushReplacement(context,
            MaterialPageRoute(builder: (_) => const RoleSelectionPage()));
      } else {
        _showSnackBar(data['error'] ?? 'Invalid credentials', isError: true);
      }
    } catch (e) {
      _showSnackBar('Network error', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
              colors: [Color(0xFF93C5FD), Colors.white],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 60),
                const Text('Welcome Back!',
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF3B82F6))),
                Text('Login to track your bus live',
                    style: TextStyle(fontSize: 16, color: Colors.grey[700])),
                const SizedBox(height: 50),
                CustomInputField(label: 'Email', icon: Icons.email, controller: emailController),
                CustomInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                const SizedBox(height: 30),
                GradientButton(text: 'Login to SwiftRide', onPressed: handleLogin),
                const SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SignupPage())),
                    child: const Text("Don't have an account? Sign up",
                        style: TextStyle(color: Color(0xFF3B82F6), decoration: TextDecoration.underline)),
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

// Signup page bhi same — chhota sa fix kiya hai
class SignupPage extends StatefulWidget {
  const SignupPage({super.key});
  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  String role = 'passenger';
  bool _obscurePassword = true;

  Future<void> handleSignup() async {
    try {
      final response = await http.post(
        Uri.parse('https://project1-13.onrender.com/api/signup'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "email": emailController.text.trim(),
          "password": passwordController.text,
          "role": role,
          "name": emailController.text.split('@').first
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 201 && data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Account created! Now login"), backgroundColor: Colors.green));
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginPage()));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['error'] ?? "Signup failed"), backgroundColor: Colors.red));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Same UI as before — no change needed
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFF93C5FD), Colors.white], begin: Alignment.topCenter, end: Alignment.bottomCenter),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 60),
                const Text('Create Account', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF3B82F6))),
                const SizedBox(height: 50),
                CustomInputField(label: 'Email', icon: Icons.email, controller: emailController),
                CustomInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15), boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 5))]),
                  child: DropdownButtonFormField<String>(
                    value: role,
                    decoration: const InputDecoration(border: InputBorder.none, labelText: "Select Role", prefixIcon: Icon(Icons.person, color: Color(0xFF3B82F6))),
                    items: const [
                      DropdownMenuItem(child: Text("Passenger"), value: "passenger"),
                      DropdownMenuItem(child: Text("Driver"), value: "driver"),
                    ],
                    onChanged: (val) => setState(() => role = val!),
                  ),
                ),
                const SizedBox(height: 30),
                GradientButton(text: 'Create Account', onPressed: handleSignup),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ==================== ROLE SELECTION ====================
class RoleSelectionPage extends StatelessWidget {
  const RoleSelectionPage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Choose Your Role'), backgroundColor: const Color(0xFF3B82F6), foregroundColor: Colors.white),
      body: Container(
        decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [Color(0xFFF3F4F6), Color(0xFFE5E7EB)], begin: Alignment.topCenter, end: Alignment.bottomCenter)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _RoleCard(
                  title: "Passenger Panel",
                  subtitle: "Track your bus in real-time",
                  icon: Icons.person,
                  color: Colors.green,
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BusListPage()))),
              const SizedBox(height: 30),
              _RoleCard(
                  title: "Driver Panel",
                  subtitle: "Start trip & share live location",
                  icon: Icons.directions_bus,
                  color: const Color(0xFF3B82F6),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DriverPanel()))),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  const _RoleCard({required this.title, required this.subtitle, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(30),
        decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.9),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: color.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10))]),
        child: Row(
          children: [
            CircleAvatar(radius: 35, backgroundColor: color.withOpacity(0.2), child: Icon(icon, size: 40, color: color)),
            const SizedBox(width: 20),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)), Text(subtitle, style: const TextStyle(color: Colors.black54))])),
            const Icon(Icons.arrow_forward_ios, color: Colors.black54),
          ],
        ),
      ),
    );
  }
}

// ==================== BUS LIST ====================
class BusListPage extends StatefulWidget {
  const BusListPage({super.key});
  @override
  State<BusListPage> createState() => _BusListPageState();
}

class _BusListPageState extends State<BusListPage> {
  List<dynamic> buses = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    fetchBuses();
  }

  Future<void> fetchBuses() async {
    try {
      final res = await http.get(Uri.parse("https://project1-13.onrender.com/vehicles"));
      if (res.statusCode == 200) {
        setState(() {
          buses = jsonDecode(res.body);
          loading = false;
        });
      }
    } catch (e) {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Select Your Bus"), backgroundColor: Colors.green),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: fetchBuses,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: buses.length,
                itemBuilder: (context, i) {
                  final bus = buses[i];
                  final isLive = bus['currentLocation']?['lat'] != null;
                  return Card(
                    elevation: 8,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    child: ListTile(
                      leading: CircleAvatar(
                          backgroundColor: isLive ? Colors.green : Colors.grey,
                          child: Icon(isLive ? Icons.directions_bus : Icons.directions_bus_outlined, color: Colors.white)),
                      title: Text(bus['number'] ?? "Bus ${i + 1}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                      subtitle: Text(bus['driverName'] ?? "Unknown Driver"),
                      trailing: Chip(
                          label: Text(isLive ? "LIVE" : "Offline"),
                          backgroundColor: isLive ? Colors.green : Colors.grey,
                          labelStyle: const TextStyle(color: Colors.white)),
                      onTap: isLive
                          ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => PassengerPanel(vehicleId: bus['_id'])))
                          : null,
                    ),
                  );
                },
              ),
            ),
    );
  }
}

// ==================== PASSENGER PANEL – ZOMATO LEVEL ====================
// passenger_panel.dart

// ==================== PASSENGER PANEL – FINAL WORKING VERSION ====================
class PassengerPanel extends StatefulWidget {
  final String vehicleId;
  const PassengerPanel({required this.vehicleId, super.key});

  @override
  State<PassengerPanel> createState() => _PassengerPanelState();
}

class _PassengerPanelState extends State<PassengerPanel> {
  final MapController mapController = MapController();
  late IO.Socket socket;

  LatLng busLocation = const LatLng(19.0760, 72.8777);
  double busBearing = 0.0;
  String eta = "Calculating...";
  String status = "Connecting...";

  final Distance distance = Distance(); // ye line zaroori hai

  @override
  void initState() {
    super.initState();
    _connectToSocket();
  }

  void _connectToSocket() {
    socket = IO.io('https://project1-13.onrender.com', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });

    socket.connect();

    socket.onConnect((_) {
      setState(() => status = "Live 🚍");
      socket.emit('joinVehicle', widget.vehicleId);
    });

    socket.on('locationUpdate', (data) {
      final lat = (data['lat'] as num?)?.toDouble();
      final lng = (data['lng'] as num?)?.toDouble();
      final bearing = (data['bearing'] as num? ?? 0.0).toDouble();

      if (lat == null || lng == null) return;

      final newLocation = LatLng(lat, lng);

      setState(() {
        busLocation = newLocation;
        busBearing = bearing;
        final meters = distance(const LatLng(19.0760, 72.8777), newLocation);
        final minutes = (meters / 1000 / 30 * 60).round();
        eta = minutes <= 1 ? "Arriving now" : "$minutes min";
      });

      mapController.moveAndRotate(newLocation, 16.5, bearing);
    });
  }

  @override
  void dispose() {
    socket.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Live Bus Tracking"), backgroundColor: Colors.green[700]),
      body: Stack(
        children: [
          FlutterMap(
            mapController: mapController,
            options: MapOptions(initialCenter: busLocation, initialZoom: 15.0),
            children: [
              TileLayer(
                urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                subdomains: const ['a', 'b', 'c'],
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: busLocation,
                    width: 120.0,   // YE THA MISSING – AB BUS DIKHEGI!!!
                    height: 120.0,
                    child: RotationTransition(
                      turns: AlwaysStoppedAnimation(busBearing / 360),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          TweenAnimationBuilder(
                            tween: Tween(begin: 0.0, end: 1.0),
                            duration: const Duration(seconds: 2),
                            builder: (_, value, __) => Transform.scale(
                              scale: value * 4,
                              child: Container(
                                width: 80,
                                height: 80,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.green.withOpacity(0.4 - value * 0.4),
                                ),
                              ),
                            ),
                          ),
                          const Icon(Icons.directions_bus_filled_rounded, size: 60, color: Colors.green),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            top: 20,
            left: 20,
            right: 20,
            child: Card(
              elevation: 10,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    CircleAvatar(backgroundColor: Colors.green[700], child: const Icon(Icons.directions_bus, color: Colors.white)),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Status: $status", style: const TextStyle(fontSize: 16)),
                        Text(eta, style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
// ==================== DRIVER PANEL ====================
class DriverPanel extends StatefulWidget {
  const DriverPanel({super.key});
  @override
  State<DriverPanel> createState() => _DriverPanelState();
}

class _DriverPanelState extends State<DriverPanel> {
  final fromC = TextEditingController();
  final toC = TextEditingController();
  final nameC = TextEditingController();
  final numberC = TextEditingController();

  Future<void> startTrip() async {
    if (nameC.text.isEmpty || numberC.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Fill all fields")));
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => DriverMapScreen(
                from: fromC.text,
                to: toC.text,
                driverName: nameC.text,
                busNumber: numberC.text,
                token: token)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Driver Dashboard"), backgroundColor: const Color(0xFF3B82F6)),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CustomInputField(label: "Driver Name", icon: Icons.person, controller: nameC),
            CustomInputField(label: "Bus Number", icon: Icons.directions_bus, controller: numberC),
            CustomInputField(label: "From", icon: Icons.location_on, controller: fromC),
            CustomInputField(label: "To", icon: Icons.flag, controller: toC),
            const SizedBox(height: 40),
            GradientButton(text: "Start Live Trip", onPressed: startTrip),
          ],
        ),
      ),
    );
  }
}

// ==================== DRIVER MAP SCREEN ====================
class DriverMapScreen extends StatefulWidget {
  final String from, to, driverName, busNumber, token;
  const DriverMapScreen({required this.from, required this.to, required this.driverName, required this.busNumber, required this.token, super.key});

  @override
  State<DriverMapScreen> createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen> {
  LatLng pos = const LatLng(19.0760, 72.8777);
  Timer? timer;

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => updateLocation());
  }

  Future<void> updateLocation() async {
  try {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    final newPos = LatLng(position.latitude, position.longitude);
    setState(() => pos = newPos);
final encodedBusNumber = Uri.encodeComponent(widget.busNumber.trim());

    await http.put(
 Uri.parse("https://project1-13.onrender.com/vehicles/$encodedBusNumber/location"),


  headers: {
    "Authorization": "Bearer ${widget.token}",
    "Content-Type": "application/json"
  },
  body: jsonEncode({
    "lat": position.latitude,
    "lng": position.longitude,
    "bearing": position.heading ?? 0.0
  }),
);
  } catch (e) {
    debugPrint("Location error: $e");
  }
}
  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("LIVE TRIP ACTIVE"),
        backgroundColor: Colors.red,
        actions: [
          TextButton(
              onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
              child: const Text("End Trip", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))
        ],
      ),
      body: FlutterMap(
        options: MapOptions(initialCenter: pos, initialZoom: 16),
        children: [
          TileLayer(urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: const ['a', 'b', 'c']),
          MarkerLayer(markers: [Marker(point: pos, child: const Icon(Icons.directions_bus, size: 60, color: Colors.red))]),
        ],
      ),
    );
  }
}
