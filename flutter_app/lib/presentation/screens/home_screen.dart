import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('FanFlow AI'),
        actions: [
          IconButton(icon: const Icon(Icons.person), onPressed: () {}),
        ],
      ),
      body: GridView.count(
        crossAxisCount: 2,
        padding: const EdgeInsets.all(16),
        children: const [
          // Bento-style widgets would go here
          Card(child: Center(child: Text('Crowd Routing'))),
          Card(child: Center(child: Text('Virtual Queue'))),
          Card(child: Center(child: Text('AI Concierge'))),
        ],
      ),
    );
  }
}
