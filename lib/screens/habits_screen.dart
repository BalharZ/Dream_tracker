import 'package:flutter/material.dart';
import '../main.dart';
import '../generated/S.dart';

class HabitsScreen extends StatefulWidget {
  const HabitsScreen({super.key});

  @override
  HabitsScreenState createState() => HabitsScreenState();
}

class HabitsScreenState extends State<HabitsScreen> {
  List<Map<String, dynamic>> _habits = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHabits();
  }

  Future<void> _loadHabits() async {
    setState(() => _isLoading = true);
    final data = await supabase
        .from('habits')
        .select()
        .order('created_at', ascending: false);
    setState(() {
      _habits = List<Map<String, dynamic>>.from(data);
      _isLoading = false;
    });
  }

  void showAddDialog() {
    final nameCtrl = TextEditingController();
    final unitCtrl = TextEditingController();
    final targetCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        final s = S.of(context);
        return AlertDialog(
          title: Text(s.addHabitTitle),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: InputDecoration(labelText: s.habitName),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: unitCtrl,
                  decoration: InputDecoration(labelText: s.habitUnit),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: targetCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: s.habitDailyTarget),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(s.cancel),
            ),
            FilledButton(
              onPressed: () async {
                if (nameCtrl.text.isEmpty || unitCtrl.text.isEmpty || targetCtrl.text.isEmpty) return;
                await supabase.from('habits').insert({
                  'user_id': supabase.auth.currentUser!.id,
                  'name': nameCtrl.text,
                  'unit': unitCtrl.text,
                  'daily_target': int.tryParse(targetCtrl.text) ?? 1,
                  'progress': 0,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                _loadHabits();
              },
              child: Text(s.addHabitButton),
            ),
          ],
        );
      },
    );
  }

  Future<void> _incrementProgress(Map<String, dynamic> habit) async {
    final newProgress = (habit['progress'] as int) + 1;
    await supabase
        .from('habits')
        .update({'progress': newProgress})
        .eq('id', habit['id']);
    _loadHabits();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_habits.isEmpty) {
      return Center(child: Text(s.noHabitsMessage));
    }

    return RefreshIndicator(
      onRefresh: _loadHabits,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _habits.length,
        itemBuilder: (context, index) {
          final habit = _habits[index];
          final progress = habit['progress'] as int;
          final target = habit['daily_target'] as int;
          final unit = habit['unit'] as String;
          final ratio = target > 0 ? (progress / target).clamp(0.0, 1.0) : 0.0;

          return Card(
            child: ListTile(
              leading: Icon(
                progress >= target ? Icons.check_circle : Icons.check_circle_outline,
                size: 40,
                color: progress >= target ? Colors.green : null,
              ),
              title: Text(habit['name']),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$progress / $target $unit'),
                  const SizedBox(height: 4),
                  LinearProgressIndicator(value: ratio),
                ],
              ),
              trailing: IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => _incrementProgress(habit),
              ),
            ),
          );
        },
      ),
    );
  }
}
