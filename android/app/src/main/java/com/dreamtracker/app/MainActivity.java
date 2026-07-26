package com.dreamtracker.app;

import android.os.Bundle;

import com.dreamtracker.app.reminders.HabitReminderPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HabitReminderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
