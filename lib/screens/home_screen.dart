import 'package:flutter/material.dart';
import '../generated/S.dart';
import '../app_drawer.dart';
import 'dreams_screen.dart';
import 'goals_screen.dart';
import 'habits_screen.dart';
import 'rewards_screen.dart';

class HomeScreen extends StatefulWidget {
  final Function(Locale) onChangeLanguage;

  const HomeScreen({super.key, required this.onChangeLanguage});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _dreamsKey = GlobalKey<DreamsScreenState>();
  final _goalsKey = GlobalKey<GoalsScreenState>();
  final _habitsKey = GlobalKey<HabitsScreenState>();
  final _rewardsKey = GlobalKey<RewardsScreenState>();

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);

    final screens = [
      DreamsScreen(key: _dreamsKey),
      GoalsScreen(key: _goalsKey),
      HabitsScreen(key: _habitsKey),
      RewardsScreen(key: _rewardsKey),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(s.appName),
      ),
      drawer: AppDrawer(onChangeLanguage: widget.onChangeLanguage),
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          switch (_currentIndex) {
            case 0:
              _dreamsKey.currentState?.showAddDialog();
            case 1:
              _goalsKey.currentState?.showAddDialog();
            case 2:
              _habitsKey.currentState?.showAddDialog();
            case 3:
              _rewardsKey.currentState?.showAddDialog();
          }
        },
        child: const Icon(Icons.add),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.nightlight_outlined),
            selectedIcon: const Icon(Icons.nightlight_round),
            label: s.menuDreams,
          ),
          NavigationDestination(
            icon: const Icon(Icons.flag_outlined),
            selectedIcon: const Icon(Icons.flag),
            label: s.menuGoals,
          ),
          NavigationDestination(
            icon: const Icon(Icons.repeat_outlined),
            selectedIcon: const Icon(Icons.repeat),
            label: s.menuHabits,
          ),
          NavigationDestination(
            icon: const Icon(Icons.card_giftcard_outlined),
            selectedIcon: const Icon(Icons.card_giftcard),
            label: s.menuRewards,
          ),
        ],
      ),
    );
  }
}
