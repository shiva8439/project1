// full updated file (replace your current file with this)
import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

void main() => runApp(const BusI());

class BusI extends StatelessWidget {
  const BusI({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: ' BusI',
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

    _controller =
        AnimationController(duration: const Duration(seconds: 2), vsync: this);
    _fadeAnimation = Tween<double>(begin: 0, end: 1)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _scaleAnimation = Tween<double>(begin: 0.5, end: 1)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.bounceOut));

    _controller.forward();
    _checkLogin(); // 🔥 AUTO LOGIN CHECK
  }

  Future<void> _checkLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');

    await Future.delayed(const Duration(seconds: 3)); // splash delay

    if (!mounted) return;

    if (token == null || token.isEmpty) {
      Navigator.pushReplacement(
          context, MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    try {
      final res = await http.get(
        Uri.parse('https://project1-13.onrender.com/api/auth/me'),
        headers: {
          "Authorization": "Bearer $token",
        },
      );

      if (!mounted) return;

      if (res.statusCode == 200) {
        Navigator.pushReplacement(context,
            MaterialPageRoute(builder: (_) => const RoleSelectionPage()));
      } else {
        await prefs.remove('token');
        Navigator.pushReplacement(
            context, MaterialPageRoute(builder: (_) => const LoginPage()));
      }
    } catch (e) {
      Navigator.pushReplacement(
          context, MaterialPageRoute(builder: (_) => const LoginPage()));
    }
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
                      Icon(Icons.directions_bus_filled,
                          size: 100, color: Colors.white),
                      SizedBox(height: 20),
                      Text(' BusI',
                          style: TextStyle(
                              fontSize: 48,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 4)),
                      SizedBox(height: 10),
                      Text('Your Journey, Our Priority',
                          style:
                              TextStyle(fontSize: 16, color: Colors.white70)),
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
                  icon: Icon(
                      obscureText ? Icons.visibility : Icons.visibility_off,
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
  const GradientButton(
      {required this.text, required this.onPressed, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 55,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)]),
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
        await prefs.setString(
            'user_name', data['user']['name'] ?? data['user']['email']);

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
                    style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF3B82F6))),
                Text('Login to track your bus live',
                    style: TextStyle(fontSize: 16, color: Colors.grey[700])),
                const SizedBox(height: 50),
                CustomInputField(
                    label: 'Email',
                    icon: Icons.email,
                    controller: emailController),
                CustomInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
                const SizedBox(height: 30),
                GradientButton(
                    text: 'Login to SwiftRide', onPressed: handleLogin),
                const SizedBox(height: 20),
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const SignupPage())),
                    child: const Text("Don't have an account? Sign up",
                        style: TextStyle(
                            color: Color(0xFF3B82F6),
                            decoration: TextDecoration.underline)),
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

// SignupPage same as before
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
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text("Account created! Now login"),
            backgroundColor: Colors.green));
        Navigator.pushReplacement(
            context, MaterialPageRoute(builder: (_) => const LoginPage()));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(data['error'] ?? "Signup failed"),
            backgroundColor: Colors.red));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red));
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
                const Text('Create Account',
                    style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF3B82F6))),
                const SizedBox(height: 50),
                CustomInputField(
                    label: 'Email',
                    icon: Icons.email,
                    controller: emailController),
                CustomInputField(
                  label: 'Password',
                  icon: Icons.lock,
                  controller: passwordController,
                  isPassword: true,
                  obscureText: _obscurePassword,
                  onTogglePassword: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
                Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: const [
                        BoxShadow(
                            color: Colors.black12,
                            blurRadius: 10,
                            offset: Offset(0, 5))
                      ]),
                  child: DropdownButtonFormField<String>(
                    value: role,
                    decoration: const InputDecoration(
                        border: InputBorder.none,
                        labelText: "Select Role",
                        prefixIcon:
                            Icon(Icons.person, color: Color(0xFF3B82F6))),
                    items: const [
                      DropdownMenuItem(
                          child: Text("Passenger"), value: "passenger"),
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

// ==================== ROLE SELECTION (with logout) ====================
// ==================== ROLE SELECTION (with logout & profile) ====================
class RoleSelectionPage extends StatelessWidget {
  const RoleSelectionPage({super.key});

  // 🔹 Logout function
  Future<void> logout(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user_role');
    await prefs.remove('user_name');

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose Your Role'),
        backgroundColor: const Color(0xFF3B82F6),
        actions: [
          // Profile button
          IconButton(
            icon: const Icon(Icons.person),
            tooltip: "Profile",
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfilePage()),
              );
            },
          ),
          // Logout button
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: "Logout",
            onPressed: () => logout(context),
          )
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFF3F4F6), Color(0xFFE5E7EB)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _RoleCard(
                title: "Driver Panel",
                subtitle: "Start trip & share live location",
                icon: Icons.directions_bus,
                color: const Color(0xFF3B82F6),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const DriverPanel()),
                ),
              ),
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

  const _RoleCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(30),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.9),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.3),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 35,
              backgroundColor: color.withOpacity(0.2),
              child: Icon(icon, size: 40, color: color),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.bold)),
                  Text(subtitle, style: const TextStyle(color: Colors.black54)),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios, color: Colors.black54),
          ],
        ),
      ),
    );
  }
}

// ==================== PROFILE PAGE ====================
class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  Future<Map<String, String?>> getUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final name = prefs.getString('user_name');
    final role = prefs.getString('user_role');
    return {'name': name, 'role': role};
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Profile"),
        backgroundColor: const Color(0xFF3B82F6),
      ),
      body: FutureBuilder<Map<String, String?>>(
        future: getUserData(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final user = snapshot.data!;
          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 30),
                Text("Name: ${user['name'] ?? 'N/A'}",
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                Text("Role: ${user['role'] ?? 'N/A'}",
                    style: const TextStyle(fontSize: 18, color: Colors.grey)),
                const SizedBox(height: 40),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      minimumSize: const Size.fromHeight(50)),
                  icon: const Icon(Icons.logout),
                  label: const Text("Logout"),
                  onPressed: () async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.clear();
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginPage()),
                      (route) => false,
                    );
                  },
                )
              ],
            ),
          );
        },
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
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text("Fill all fields")));
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
      appBar: AppBar(
          title: const Text("Driver Dashboard"),
          backgroundColor: const Color(0xFF3B82F6)),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CustomInputField(
                label: "Driver Name", icon: Icons.person, controller: nameC),
            CustomInputField(
                label: "Bus Number",
                icon: Icons.directions_bus,
                controller: numberC),
            CustomInputField(
                label: "From", icon: Icons.location_on, controller: fromC),
            CustomInputField(label: "To", icon: Icons.flag, controller: toC),
            const SizedBox(height: 20),

            // NEW: Buttons to add bus / stop / route
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.add_box),
                    label: const Text("Add Bus"),
                    onPressed: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const AddBusPage())),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3B82F6)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.location_on),
                    label: const Text("Add Stop"),
                    onPressed: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const AddStopPage())),
                    style:
                        ElevatedButton.styleFrom(backgroundColor: Colors.teal),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.alt_route),
                    label: const Text("Add Route"),
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const AddRoutePage())),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: Container()), // spacer
              ],
            ),

            const SizedBox(height: 20),
            GradientButton(text: "Start Live Trip", onPressed: startTrip),
          ],
        ),
      ),
    );
  }
}

// ==================== Add Bus Page ====================
class AddBusPage extends StatefulWidget {
  const AddBusPage({super.key});

  @override
  State<AddBusPage> createState() => _AddBusPageState();
}

class _AddBusPageState extends State<AddBusPage> {
  final numberC = TextEditingController();
  final driverC = TextEditingController();
  final fromC = TextEditingController();
  final toC = TextEditingController();
  bool loading = false;

  void _show(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.red : Colors.green));
  }

  Future<void> submit() async {
    final number = numberC.text.trim();
    final driverName = driverC.text.trim();
    final from = fromC.text.trim();
    final to = toC.text.trim();
    if (number.isEmpty || driverName.isEmpty) {
      _show("Bus number & driver name required", error: true);
      return;
    }
    setState(() => loading = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';

    debugPrint("=== BUS REGISTRATION DEBUG ===");
    debugPrint("Token: ${token.isNotEmpty ? 'Present' : 'Missing'}");
    debugPrint(
        "Bus data: number=$number, driver=$driverName, from=$from, to=$to");

    try {
      // First check if bus number already exists
      final checkResponse = await http.get(
        Uri.parse('https://project1-13.onrender.com/buses'),
        headers: {
          "Authorization": "Bearer $token",
        },
      );

      if (checkResponse.statusCode == 200) {
        final checkData = jsonDecode(checkResponse.body);
        if (checkData['success'] == true && checkData['buses'] != null) {
          final existingBuses = checkData['buses'] as List;
          final duplicateBus = existingBuses.firstWhere(
            (bus) =>
                bus['busNumber']?.toString().toLowerCase() ==
                number.toLowerCase(),
            orElse: () => null,
          );

          if (duplicateBus != null) {
            _show(
                "Bus number '$number' already exists! Please use a different number.",
                error: true);
            setState(() => loading = false);
            return;
          }
        }
      }

      final response = await http
          .post(
            Uri.parse(
                'https://project1-13.onrender.com/api/driver/register-vehicle'),
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer $token",
            },
            body: jsonEncode({
              "number": number,
              "driverName": driverName,
              "from": from,
              "to": to,
              "busNumber": number,
              "route": from + " - " + to
            }),
          )
          .timeout(const Duration(seconds: 15));

      debugPrint("=== RESPONSE DEBUG ===");
      debugPrint("Status Code: ${response.statusCode}");
      debugPrint("Headers: ${response.headers}");
      debugPrint("Body: ${response.body}");

      if (response.statusCode == 200 || response.statusCode == 201) {
        try {
          final data = jsonDecode(response.body);
          debugPrint("Parsed Data: $data");

          if (data['success'] == true) {
            _show("✅ Bus registered successfully!");
            Navigator.pop(context);
          } else {
            _show(data['error'] ?? "Registration failed", error: true);
          }
        } catch (e) {
          debugPrint("JSON Parse Error: $e");
          _show("Server response error", error: true);
        }
      } else {
        _show("Server error: ${response.statusCode}", error: true);
      }
    } catch (e) {
      debugPrint("=== NETWORK ERROR ===");
      debugPrint("Error: $e");
      _show("Network error: $e", error: true);
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    numberC.dispose();
    driverC.dispose();
    fromC.dispose();
    toC.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text("Register Bus"),
          backgroundColor: const Color(0xFF3B82F6)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            CustomInputField(
                label: "Bus Number",
                icon: Icons.directions_bus,
                controller: numberC),
            CustomInputField(
                label: "Driver Name", icon: Icons.person, controller: driverC),
            CustomInputField(
                label: "From", icon: Icons.location_on, controller: fromC),
            CustomInputField(label: "To", icon: Icons.flag, controller: toC),
            const SizedBox(height: 16),
            loading
                ? const CircularProgressIndicator()
                : GradientButton(text: "Add Bus", onPressed: submit),
          ],
        ),
      ),
    );
  }
}

// ==================== Add Stop Page ====================
class AddStopPage extends StatefulWidget {
  const AddStopPage({super.key});
  @override
  State<AddStopPage> createState() => _AddStopPageState();
}

class _AddStopPageState extends State<AddStopPage> {
  final nameC = TextEditingController();
  final latC = TextEditingController();
  final lngC = TextEditingController();
  bool loading = false;

  void _show(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          backgroundColor: error ? Colors.red : Colors.green));

  Future<void> useCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);
      latC.text = pos.latitude.toString();
      lngC.text = pos.longitude.toString();
    } catch (e) {
      _show("Unable to get location: $e", error: true);
    }
  }

  Future<void> submit() async {
    final name = nameC.text.trim();
    final lat = double.tryParse(latC.text.trim());
    final lng = double.tryParse(lngC.text.trim());
    if (name.isEmpty || lat == null || lng == null) {
      _show("Name, lat & lng required", error: true);
      return;
    }
    setState(() => loading = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';

    try {
      final res = await http.post(
        Uri.parse("https://project1-13.onrender.com/api/stops"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({"name": name, "lat": lat, "lng": lng}),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 201 && data['success'] == true) {
        _show("Stop created");
        Navigator.pop(context);
      } else {
        _show(data['error'] ?? "Failed to create stop", error: true);
      }
    } catch (e) {
      _show("Network error: $e", error: true);
    } finally {
      setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    nameC.dispose();
    latC.dispose();
    lngC.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(title: const Text("Add Stop"), backgroundColor: Colors.teal),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            CustomInputField(
                label: "Stop Name", icon: Icons.place, controller: nameC),
            CustomInputField(
                label: "Latitude", icon: Icons.map, controller: latC),
            CustomInputField(
                label: "Longitude", icon: Icons.map_outlined, controller: lngC),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                    child: ElevatedButton.icon(
                        onPressed: useCurrentLocation,
                        icon: const Icon(Icons.my_location),
                        label: const Text("Use current location"))),
                const SizedBox(width: 8),
                Expanded(
                    child: loading
                        ? const Center(child: CircularProgressIndicator())
                        : ElevatedButton(
                            onPressed: submit, child: const Text("Save Stop"))),
              ],
            )
          ],
        ),
      ),
    );
  }
}

// ==================== Add Route Page ====================
class AddRoutePage extends StatefulWidget {
  const AddRoutePage({super.key});
  @override
  State<AddRoutePage> createState() => _AddRoutePageState();
}

class _AddRoutePageState extends State<AddRoutePage> {
  final nameC = TextEditingController();
  final fromC = TextEditingController();
  final toC = TextEditingController();
  bool loading = false;
  List<dynamic> stops = [];
  Map<String, bool> selected = {};

  void _show(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          backgroundColor: error ? Colors.red : Colors.green));

  @override
  void initState() {
    super.initState();
    fetchStops();
  }

  Future<void> fetchStops() async {
    try {
      final res = await http
          .get(Uri.parse("https://project1-13.onrender.com/api/stops"));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        // server returns { success: true, stops: [...] } or array depending on server version — handle both
        final list = data is List ? data : (data['stops'] ?? []);
        setState(() {
          stops = list;
          selected = {
            for (var s in stops)
              (s['_id'] ?? s['id'] ?? s['__id'] ?? s['id'].toString()): false
          };
        });
      }
    } catch (_) {}
  }

  Future<void> submit() async {
    final name = nameC.text.trim();
    final from = fromC.text.trim();
    final to = toC.text.trim();
    final chosen =
        selected.entries.where((e) => e.value).map((e) => e.key).toList();
    if (name.isEmpty) {
      _show("Route name required", error: true);
      return;
    }
    setState(() => loading = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';

    try {
      final res = await http.post(
        Uri.parse("https://project1-13.onrender.com/api/routes"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body:
            jsonEncode({"name": name, "from": from, "to": to, "stops": chosen}),
      );
      final data = jsonDecode(res.body);
      if (res.statusCode == 201 && data['success'] == true) {
        _show("Route created");
        Navigator.pop(context);
      } else {
        _show(data['error'] ?? "Failed to create route", error: true);
      }
    } catch (e) {
      _show("Network error: $e", error: true);
    } finally {
      setState(() => loading = false);
    }
  }

  Widget _stopTile(dynamic s) {
    final id = s['_id'] ?? s['id'] ?? s['__id'] ?? s['id'].toString();
    final name = s['name'] ?? 'Stop';
    final lat = s['lat']?.toString() ?? '';
    final lng = s['lng']?.toString() ?? '';
    return CheckboxListTile(
      value: selected[id] ?? false,
      title: Text(name),
      subtitle: Text("$lat, $lng"),
      onChanged: (v) => setState(() => selected[id] = v ?? false),
    );
  }

  @override
  void dispose() {
    nameC.dispose();
    fromC.dispose();
    toC.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: const Text("Create Route"), backgroundColor: Colors.orange),
      body: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            CustomInputField(
                label: "Route Name", icon: Icons.title, controller: nameC),
            CustomInputField(
                label: "From", icon: Icons.location_pin, controller: fromC),
            CustomInputField(label: "To", icon: Icons.flag, controller: toC),
            const SizedBox(height: 8),
            const Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 8.0),
                    child: Text("Select stops (optional)",
                        style: TextStyle(fontWeight: FontWeight.bold)))),
            Expanded(
              child: stops.isEmpty
                  ? const Center(child: Text("No stops loaded"))
                  : ListView.builder(
                      itemCount: stops.length,
                      itemBuilder: (_, i) => _stopTile(stops[i])),
            ),
            const SizedBox(height: 8),
            loading
                ? const CircularProgressIndicator()
                : GradientButton(text: "Create Route", onPressed: submit),
          ],
        ),
      ),
    );
  }
}

// ==================== DRIVER MAP SCREEN ====================

class DriverMapScreen extends StatefulWidget {
  final String from, to, driverName, busNumber, token;

  const DriverMapScreen({
    required this.from,
    required this.to,
    required this.driverName,
    required this.busNumber,
    required this.token,
    super.key,
  });

  @override
  State<DriverMapScreen> createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen> {
  LatLng pos = const LatLng(19.0760, 72.8777);
  Timer? timer;
  bool loading = true;

  late IO.Socket socket;

  @override
  void initState() {
    super.initState();
    _requestLocationPermission();
    connectSocket();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => updateLocation());
  }

  // 🔥 Request Location Permission
  Future<void> _requestLocationPermission() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showLocationError("Location permission denied");
          return;
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        _showLocationError("Location permission permanently denied");
        return;
      }

      // Get initial location
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      setState(() {
        pos = LatLng(position.latitude, position.longitude);
        loading = false;
      });
    } catch (e) {
      debugPrint("Location permission error: $e");
      setState(() => loading = false);
    }
  }

  void _showLocationError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        action: SnackBarAction(
          label: "Settings",
          onPressed: () => Geolocator.openAppSettings(),
        ),
      ),
    );
  }

  // 🔥 Connect Driver to Socket
  void connectSocket() {
    socket = IO.io(
      "https://project1-13.onrender.com",
      {
        "transports": ["websocket"],
        "autoConnect": false,
      },
    );

    socket.connect();

    socket.onConnect((_) {
      debugPrint("🚍 Driver connected to socket");

      // Join room using busNumber
      socket.emit("join-bus", widget.busNumber);
    });
  }

  // 🔥 Update driver location (Socket + HTTP)
  Future<void> updateLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high);

      final newPos = LatLng(position.latitude, position.longitude);
      setState(() => pos = newPos);

      final encodedBusNumber = Uri.encodeComponent(widget.busNumber.trim());

      // 1️⃣ Send location via HTTP for saving in DB
      print("PUT BUS → $encodedBusNumber");

      await http.put(
        Uri.parse(
            "https://project1-13.onrender.com/bus/$encodedBusNumber/location"),
        headers: {
          "Authorization": "Bearer ${widget.token}",
          "Content-Type": "application/json"
        },
        body: jsonEncode({
          "lat": position.latitude,
          "lng": position.longitude,
          "bearing": position.heading,
        }),
      );

      // 2️⃣ Send LIVE location to socket
      print("SOCKET BUS → ${widget.busNumber}"); // ← YAHAN ADD KARO

      socket.emit("driver-location-update", {
        "busNumber": widget.busNumber.trim(), // FIXED KEY
        "lat": position.latitude,
        "lng": position.longitude,
        "bearing": position.heading,
      });

      debugPrint(
          "Driver Location → ${position.latitude}, ${position.longitude}");
    } catch (e) {
      debugPrint("Location error: $e");
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    socket.dispose();
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
            onPressed: () =>
                Navigator.popUntil(context, (route) => route.isFirst),
            child: const Text(
              "End Trip",
              style:
                  TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
      body: loading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text("Getting location..."),
                ],
              ),
            )
          : FlutterMap(
              options: MapOptions(
                initialCenter: pos,
                initialZoom: 16,
                minZoom: 3,
                maxZoom: 19,
              ),
              children: [
                TileLayer(
                  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                  subdomains: const ['a', 'b', 'c'],
                  userAgentPackageName: 'com.example.swift_ride',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: pos,
                      width: 80,
                      height: 80,
                      child: const Icon(
                        Icons.directions_bus,
                        size: 48,
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}








import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

void main() {
  runApp(const BusI());
}

class BusI extends StatelessWidget {
  const BusI({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BusI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        fontFamily: 'Roboto',
        scaffoldBackgroundColor: const Color(0xFFF5F5F5),
      ),
      home: const HomeScreen(),
    );
  }
}

// ==================== HOME SCREEN ====================
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _busController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _trackBus() async {
    final busNumber = _busController.text.trim().toUpperCase();
    if (busNumber.isEmpty) {
      setState(() => _errorMessage = "Bus number daalo bhai!");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .get(
            Uri.parse('https://project1-13.onrender.com/vehicles/search?number=$busNumber'),
          )
          .timeout(const Duration(seconds: 10));

      print('Track Response Status: ${response.statusCode}');
      print('Track Response Body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data['success'] == true && data['vehicles'].isNotEmpty) {
          final bus = data['vehicles'][0];
          final lat = bus['currentLocation']?['lat']?.toDouble();
          final lng = bus['currentLocation']?['lng']?.toDouble();
          final hasValidLocation = bus['hasValidLocation'] ?? false;

          if (lat != null && lng != null && hasValidLocation && lat != 0 && lng != 0) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => BusMapScreen(
                  busId: bus['_id']?.toString() ?? bus['number'],
                  busNumber: bus['number'],
                  initialLat: lat,
                  initialLng: lng,
                ),
              ),
            );
          } else {
            setState(() => _errorMessage = "Bus abhi live nahi hai - No GPS data");
          }
        } else {
          setState(() => _errorMessage = "Yeh bus number nahi mila");
        }
      } else {
        setState(() => _errorMessage = "Server error: ${response.statusCode}");
      }
    } catch (e) {
      print('Error: $e');
      setState(() => _errorMessage = "Network error - try again later");
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.blue[600],
        elevation: 0,
        title: const Text("Where is my Bus?", style: TextStyle(color: Colors.white)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 40),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Column(
                children: [
                  Icon(Icons.directions_bus_filled_rounded, size: 80, color: Colors.blue[600]),
                  const SizedBox(height: 16),
                  const Text("Track Your Bus", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1A237E))),
                  const SizedBox(height: 8),
                  Text("Enter bus number to see live location", style: TextStyle(fontSize: 16, color: Colors.grey[600])),
                ],
              ),
            ),
            const SizedBox(height: 40),
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text("Bus Number", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF1A237E))),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _busController,
                      textCapitalization: TextCapitalization.characters,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: "e.g. UP17, DL1P",
                        hintStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.directions_bus, color: Colors.blue),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey[300]!)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Colors.blue, width: 2)),
                        filled: true,
                        fillColor: Colors.grey[50],
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red[200]!)),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: Colors.red[600], size: 20),
                            const SizedBox(width: 8),
                            Expanded(child: Text(_errorMessage!, style: TextStyle(color: Colors.red[700], fontSize: 14))),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _trackBus,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue[600],
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          elevation: 2,
                        ),
                        child: _isLoading
                            ? const Row(mainAxisAlignment: MainAxisAlignment.center, children: [CircularProgressIndicator(color: Colors.white, strokeWidth: 2), SizedBox(width: 12), Text("Searching...")])
                            : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.search), SizedBox(width: 8), Text("Track Bus", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600))]),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ==================== LIVE MAP SCREEN WITH REAL BUS MARKER ====================
class BusMapScreen extends StatefulWidget {
  final String busId;
  final String busNumber;
  final double initialLat;
  final double initialLng;

  const BusMapScreen({
    required this.busId,
    required this.busNumber,
    required this.initialLat,
    required this.initialLng,
    super.key,
  });

  @override
  State<BusMapScreen> createState() => _BusMapScreenState();
}

class _BusMapScreenState extends State<BusMapScreen> {
  late IO.Socket socket;
  late MapController _mapController;

  LatLng _busPosition = const LatLng(28.7041, 77.1026); // fallback
  bool _isLive = false;
  String status = "Connecting...";

  @override
  void initState() {
    super.initState();
    _mapController = MapController();
    _busPosition = LatLng(widget.initialLat, widget.initialLng);

    _connectSocket();
  }

  void _connectSocket() {
    socket = IO.io('https://project1-13.onrender.com', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'timeout': 8000,
    });

    socket.connect();

    socket.onConnect((_) {
      print("Socket connected");
      socket.emit('join-bus', widget.busNumber);
      setState(() => status = "Connected – Waiting for location...");
    });

    socket.on('locationUpdate', (data) {
      final receivedBus = data['busNumber'] ?? data['busId']?.toString();
      final lat = (data['lat'] as num?)?.toDouble();
      final lng = (data['lng'] as num?)?.toDouble();

      if (receivedBus == widget.busNumber && lat != null && lng != null && lat != 0 && lng != 0) {
        setState(() {
          _busPosition = LatLng(lat, lng);
          _isLive = true;
          status = "LIVE • Bus is moving";
        });
        _mapController.move(_busPosition, 16.0);
      }
    });

    socket.onDisconnect((_) {
      setState(() {
        status = "Disconnected";
        _isLive = false;
      });
    });

    socket.onConnectError((err) {
      print("Socket connect error: $err");
      setState(() => status = "Connection failed");
    });
  }

  @override
  void dispose() {
    socket.disconnect();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.blue[600],
        elevation: 0,
        title: Text("Bus ${widget.busNumber} - Live", style: const TextStyle(color: Colors.white)),
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => Navigator.pop(context)),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _busPosition,
              initialZoom: 16.0,
              minZoom: 10,
              maxZoom: 18,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.busi',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: _busPosition,
                    width: 70,
                    height: 70,
                    child: AnimatedOpacity(
                      opacity: _isLive ? 1.0 : 0.6,
                      duration: const Duration(milliseconds: 400),
                      child: Icon(
                        Icons.directions_bus_rounded,
                        size: 50,
                        color: _isLive ? Colors.red : Colors.grey,
                        shadows: const [Shadow(blurRadius: 8, color: Colors.black45, offset: Offset(2, 2))],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Status banner
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Icon(_isLive ? Icons.circle : Icons.circle_outlined, color: _isLive ? Colors.green : Colors.orange, size: 20),
                    const SizedBox(width: 12),
                    Expanded(child: Text(status, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
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
