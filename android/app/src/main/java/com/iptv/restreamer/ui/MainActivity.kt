package com.iptv.restreamer.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.iptv.restreamer.adapter.ChannelAdapter
import com.iptv.restreamer.api.ApiClient
import com.iptv.restreamer.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

package com.iptv.restreamer.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.iptv.restreamer.ui.screens.ChannelListScreen
import com.iptv.restreamer.ui.screens.PlayerScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    NavHost(navController = navController, startDestination = "list") {
                        composable("list") {
                            ChannelListScreen(
                                onChannelClick = { channelId ->
                                    navController.navigate("player/$channelId")
                                }
                            )
                        }
                        composable(
                            route = "player/{channelId}",
                            arguments = listOf(navArgument("channelId") { type = NavType.StringType })
                        ) { backStackEntry ->
                            val channelId = backStackEntry.arguments?.getString("channelId")
                            if (channelId != null) {
                                PlayerScreen(channelId = channelId)
                            }
                        }
                    }
                }
            }
        }
    }
}
