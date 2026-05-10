import 'package:flutter/material.dart';
import '../main.dart';
import '../generated/S.dart';

class GoalsScreen extends StatefulWidget {
  const GoalsScreen({super.key});

  @override
  GoalsScreenState createState() => GoalsScreenState();
}

class GoalsScreenState extends State<GoalsScreen> {
  List<Map<String, dynamic>> _goals = [];
  List<Map<String, dynamic>> _dreams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final goals = await supabase
        .from('goals')
        .select('*, dreams(name)')
        .order('created_at', ascending: false);
    final dreams = await supabase.from('dreams').select('id, name');
    setState(() {
      _goals = List<Map<String, dynamic>>.from(goals);
      _dreams = List<Map<String, dynamic>>.from(dreams);
      _isLoading = false;
    });
  }

  void showAddDialog() {
    final nameCtrl = TextEditingController();
    String? selectedDreamId;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setDialogState) {
          final s = S.of(context);
          return AlertDialog(
            title: Text(s.addGoalTitle),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: InputDecoration(labelText: s.goalName),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(labelText: s.selectDream),
                    value: selectedDreamId,
                    items: _dreams.map((d) {
                      return DropdownMenuItem(
                        value: d['id'] as String,
                        child: Text(d['name'] as String),
                      );
                    }).toList(),
                    onChanged: (v) => setDialogState(() => selectedDreamId = v),
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
                  if (nameCtrl.text.isEmpty) return;
                  await supabase.from('goals').insert({
                    'user_id': supabase.auth.currentUser!.id,
                    'name': nameCtrl.text,
                    'dream_id': selectedDreamId,
                    'progress': 0.0,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  _loadData();
                },
                child: Text(s.addGoalButton),
              ),
            ],
          );
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_goals.isEmpty) {
      return Center(child: Text(s.noGoalsMessage));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _goals.length,
        itemBuilder: (context, index) {
          final goal = _goals[index];
          final dreamName = goal['dreams']?['name'] ?? '-';
          final progress = (goal['progress'] as num?)?.toDouble() ?? 0.0;

          return Card(
            child: ListTile(
              leading: const Icon(Icons.flag, size: 40),
              title: Text(goal['name']),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${s.relatedDreamLabel}: $dreamName'),
                  const SizedBox(height: 4),
                  LinearProgressIndicator(value: progress / 100),
                ],
              ),
              trailing: Text('${progress.toStringAsFixed(0)}%'),
            ),
          );
        },
      ),
    );
  }
}
