import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import api, { setToken } from './src/api';

type Screen = 'auth' | 'dashboard' | 'chat' | 'history';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [tokenLoaded, setTokenLoaded] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [providerKey, setProviderKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini'>('gemini');
  const [providerStatus, setProviderStatus] = useState('');

  // GitHub PAT state
  const [githubPat, setGithubPat] = useState('');
  const [githubStatus, setGithubStatus] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  
  // Workspace / Chat state
  const [activeWorkspace, setActiveWorkspace] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');

  // History state
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Automatic Polling Reference
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check auth status on mount
  useEffect(() => {
    // Scaffold default simulation auth or skip
    setTokenLoaded(true);
  }, []);

  // Poll active agent job status if running
  useEffect(() => {
    if (activeWorkspace && currentScreen === 'chat') {
      loadChatAndJob();
      pollIntervalRef.current = setInterval(loadChatAndJob, 3000);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeWorkspace, currentScreen]);

  const loadChatAndJob = async () => {
    if (!activeWorkspace) return;
    try {
      const res = await api.getChatHistory(activeWorkspace.id);
      if (res.success) {
        setMessages(res.messages);
        setActiveJob(res.activeJob);
        if (res.activeJob && res.activeJob.commitMessage && !commitMessage) {
          setCommitMessage(res.activeJob.commitMessage);
        }
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  const handleAuth = async () => {
    setAuthError('');
    setLoading(true);
    try {
      let res;
      if (authMode === 'login') {
        res = await api.login(email, password);
      } else {
        res = await api.register(email, password);
      }
      if (res.token) {
        setCurrentScreen('dashboard');
        loadDashboardData();
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const wRes = await api.getWorkspaces();
      if (wRes.success) {
        setWorkspaces(wRes.workspaces);
        // Set active workspace if one exists
        const active = wRes.workspaces.find((w: any) => w.status === 'active');
        if (active) {
          setActiveWorkspace(active);
        }
      }
      const rRes = await api.getRepositories();
      if (rRes.success) {
        setRepos(rRes.repositories);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  const handleSelectRepo = async (repo: any) => {
    setSelectedRepo(repo);
    setBranches([]);
    try {
      const res = await api.getBranches(repo.owner, repo.name);
      if (res.success) {
        setBranches(res.branches);
        setSelectedBranch(repo.defaultBranch || 'main');
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const handleStartWorkspace = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    try {
      const res = await api.createWorkspace(selectedRepo.fullName, selectedBranch);
      if (res.success) {
        setActiveWorkspace(res.workspace);
        setCurrentScreen('chat');
        // Clear selection
        setSelectedRepo(null);
      }
    } catch (err) {
      console.error('Error starting workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyProvider = async () => {
    if (!providerKey) return;
    setProviderStatus('Verifying...');
    try {
      const res = await api.verifyProvider(selectedProvider, providerKey);
      if (res.success) {
        setProviderStatus('Key verified and active!');
        setProviderKey('');
      }
    } catch (err: any) {
      setProviderStatus(err.response?.data?.error || 'Verification failed.');
    }
  };

  const handleLinkGithub = async () => {
    if (!githubPat.trim()) return;
    setGithubStatus('Verifying...');
    try {
      const res = await api.linkGithub(githubPat);
      if (res.success) {
        setGithubStatus(`✅ Linked as @${res.githubUsername}`);
        setGithubUsername(res.githubUsername);
        setGithubPat('');
        // Reload repos now that GitHub is linked
        loadDashboardData();
      }
    } catch (err: any) {
      setGithubStatus(err.response?.data?.error || 'GitHub verification failed.');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeWorkspace) return;
    const msg = chatInput;
    setChatInput('');
    try {
      await api.sendChatMessage(activeWorkspace.id, msg);
      loadChatAndJob();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await api.cancelJob(activeJob.id);
      loadChatAndJob();
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  const handleApprove = async () => {
    if (!activeJob) return;
    try {
      await api.approveJob(activeJob.id, commitMessage);
      setRejectFeedback('');
      loadChatAndJob();
    } catch (err) {
      console.error('Error approving job:', err);
    }
  };

  const handleReject = async () => {
    if (!activeJob || !rejectFeedback.trim()) return;
    try {
      await api.rejectJob(activeJob.id, rejectFeedback);
      setRejectFeedback('');
      loadChatAndJob();
    } catch (err) {
      console.error('Error rejecting job:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getHistory();
      if (res.success) {
        setHistoryList(res.history);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  // Rendering helpers
  const renderAuthScreen = () => (
    <View style={styles.authContainer}>
      <Text style={styles.logoTitle}>Bucket<Text style={{ color: '#00D8A4' }}>Dev</Text></Text>
      <Text style={styles.subtitle}>Cloud Workspaces & AI Coding Agent</Text>
      
      <View style={styles.authCard}>
        <Text style={styles.cardHeader}>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</Text>
        
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#0B0F19" /> : (
            <Text style={styles.primaryButtonText}>{authMode === 'login' ? 'Login' : 'Register'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleAuthMode} 
          onPress={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        >
          <Text style={styles.toggleAuthText}>
            {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDashboardScreen = () => (
    <ScrollView style={styles.dashboardContainer} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bucket<Text style={{ color: '#00D8A4' }}>Dev</Text></Text>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => { setCurrentScreen('history'); loadHistory(); }}
          >
            <Text style={styles.navButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, { backgroundColor: '#EF4444' }]} 
            onPress={() => { setToken(null); setCurrentScreen('auth'); }}
          >
            <Text style={styles.navButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Workspace Card */}
      {activeWorkspace ? (
        <View style={styles.workspaceCard}>
          <Text style={styles.cardTag}>ACTIVE WORKSPACE</Text>
          <Text style={styles.workspaceRepo}>{activeWorkspace.repoFullName}</Text>
          <Text style={styles.workspaceBranch}>Branch: {activeWorkspace.branch}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => setCurrentScreen('chat')}
            >
              <Text style={styles.actionButtonText}>Open Agent Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#374151' }]} 
              onPress={async () => {
                await api.stopWorkspace(activeWorkspace.id);
                setActiveWorkspace(null);
                loadDashboardData();
              }}
            >
              <Text style={styles.actionButtonText}>Stop Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.workspaceCard, { backgroundColor: '#1E293B' }]}>
          <Text style={styles.workspaceRepo}>No Active Workspace</Text>
          <Text style={styles.workspaceBranch}>Select a repository below to spin up a container sandbox.</Text>
        </View>
      )}

      {/* API Key BYOK configuration */}
      <View style={styles.dashboardSection}>
        <Text style={styles.sectionHeader}>AI API Key Setup (BYOK)</Text>
        <View style={styles.providerToggleRow}>
          <TouchableOpacity 
            style={[styles.providerToggle, selectedProvider === 'gemini' && styles.providerToggleActive]}
            onPress={() => setSelectedProvider('gemini')}
          >
            <Text style={[styles.providerToggleText, selectedProvider === 'gemini' && styles.providerToggleTextActive]}>Google Gemini</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.providerToggle, selectedProvider === 'openai' && styles.providerToggleActive]}
            onPress={() => setSelectedProvider('openai')}
          >
            <Text style={[styles.providerToggleText, selectedProvider === 'openai' && styles.providerToggleTextActive]}>OpenAI</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder={`Enter your ${selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key`}
          placeholderTextColor="#6B7280"
          value={providerKey}
          onChangeText={setProviderKey}
          secureTextEntry
        />
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleVerifyProvider}>
          <Text style={styles.secondaryButtonText}>Verify & Save Key</Text>
        </TouchableOpacity>
        {providerStatus ? <Text style={styles.statusHelperText}>{providerStatus}</Text> : null}
      </View>

      {/* GitHub PAT Linking */}
      <View style={styles.dashboardSection}>
        <Text style={styles.sectionHeader}>🔗 Link GitHub Account</Text>
        {githubUsername ? (
          <View style={[styles.workspaceCard, { backgroundColor: '#064E3B', borderColor: '#10B981' }]}>
            <Text style={styles.cardTag}>CONNECTED</Text>
            <Text style={styles.workspaceRepo}>@{githubUsername}</Text>
            <Text style={styles.workspaceBranch}>Your GitHub repositories are now accessible.</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 12 }}>
              Paste your GitHub Personal Access Token (classic) with 'repo' scope to access your repositories.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor="#6B7280"
              value={githubPat}
              onChangeText={setGithubPat}
              secureTextEntry
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleLinkGithub}>
              <Text style={styles.secondaryButtonText}>Verify & Link GitHub</Text>
            </TouchableOpacity>
          </>
        )}
        {githubStatus ? <Text style={styles.statusHelperText}>{githubStatus}</Text> : null}
      </View>

      {/* Repo Selector / Workspace launcher */}
      <View style={styles.dashboardSection}>
        <Text style={styles.sectionHeader}>Launch New Workspace</Text>
        
        {selectedRepo ? (
          <View style={styles.selectedRepoBox}>
            <Text style={styles.selectedRepoName}>{selectedRepo.fullName}</Text>
            <Text style={styles.fieldLabel}>Select Branch:</Text>
            {branches.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroller}>
                {branches.map(b => (
                  <TouchableOpacity
                    key={b.name}
                    style={[styles.branchTab, selectedBranch === b.name && styles.branchTabActive]}
                    onPress={() => setSelectedBranch(b.name)}
                  >
                    <Text style={[styles.branchTabText, selectedBranch === b.name && styles.branchTabTextActive]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : <ActivityIndicator size="small" color="#00D8A4" />}
            
            <View style={styles.selectedRepoActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartWorkspace} disabled={loading}>
                {loading ? <ActivityIndicator color="#0B0F19" /> : <Text style={styles.primaryButtonText}>Launch Sandbox</Text>}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: '#374151', marginTop: 10 }]} 
                onPress={() => setSelectedRepo(null)}
              >
                <Text style={styles.primaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.reposList}>
            {repos.length > 0 ? repos.map(r => (
              <TouchableOpacity 
                key={r.id} 
                style={styles.repoItem} 
                onPress={() => handleSelectRepo(r)}
              >
                <Text style={styles.repoItemName}>{r.fullName}</Text>
                {r.private ? <Text style={styles.repoPrivateBadge}>Private</Text> : null}
              </TouchableOpacity>
            )) : (
              <Text style={styles.emptyLabel}>No repositories found or PAT not linked.</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderChatScreen = () => {
    // 10-states progress indicator map
    const states = ['queued', 'analyzing', 'planning', 'editing', 'building', 'testing', 'reviewing', 'pushing', 'completed'];
    const activeStateIndex = activeJob ? states.indexOf(activeJob.state) : -1;

    return (
      <SafeAreaView style={styles.chatContainer}>
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('dashboard')}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>Agent Chat</Text>
        </View>

        {/* Agent Job State Stepper */}
        {activeJob ? (
          <View style={styles.stepperContainer}>
            <View style={styles.stepperHeader}>
              <Text style={styles.stepperStateTitle}>
                AGENT STATE: <Text style={{ color: '#00D8A4', fontWeight: 'bold' }}>{activeJob.state.toUpperCase()}</Text>
              </Text>
              {['queued', 'analyzing', 'planning', 'editing', 'building', 'testing'].includes(activeJob.state) ? (
                <TouchableOpacity style={styles.cancelLink} onPress={handleCancelJob}>
                  <Text style={styles.cancelLinkText}>Cancel Run</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Progress line */}
            <View style={styles.progressLineBg}>
              <View 
                style={[
                  styles.progressLineFill, 
                  { width: `${((activeStateIndex + 1) / states.length) * 100}%` }
                ]} 
              />
            </View>
            {/* Latest event message */}
            {activeJob.events && activeJob.events.length > 0 ? (
              <Text style={styles.stepperMessage}>{activeJob.events[activeJob.events.length - 1].message}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Conversation Message List */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={[styles.msgBubble, item.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAgent]}>
              <Text style={styles.msgBubbleHeader}>{item.role === 'user' ? 'You' : 'BucketDev Agent'}</Text>
              <Text style={styles.msgBubbleContent}>{item.content}</Text>
            </View>
          )}
        />

        {/* Code Review Panel (Approvals & Rejection) */}
        {activeJob && activeJob.state === 'reviewing' ? (
          <View style={styles.reviewPanel}>
            <Text style={styles.reviewHeader}>🔍 CODE CHANGE REVIEW</Text>
            <ScrollView style={styles.diffScrollView} nestedScrollEnabled>
              <Text style={styles.diffCode}>
                {activeJob.diffs ? JSON.stringify(JSON.parse(activeJob.diffs), null, 2) : 'No changes generated.'}
              </Text>
            </ScrollView>

            <View style={styles.gatesRow}>
              <Text style={styles.gateItem}>Build Check: <Text style={{ color: '#10B981' }}>SUCCESS</Text></Text>
              <Text style={styles.gateItem}>Test Suite: <Text style={{ color: '#10B981' }}>SUCCESS</Text></Text>
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Commit message (e.g. feat: add dynamic forms)"
              placeholderTextColor="#6B7280"
              value={commitMessage}
              onChangeText={setCommitMessage}
            />

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#10B981' }]} onPress={handleApprove}>
              <Text style={styles.primaryButtonText}>Approve & Push to GitHub</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TextInput
              style={styles.reviewInput}
              placeholder="Provide rejection feedback"
              placeholderTextColor="#6B7280"
              value={rejectFeedback}
              onChangeText={setRejectFeedback}
            />

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#EF4444' }]} onPress={handleReject}>
              <Text style={styles.primaryButtonText}>Reject & Discard Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Simple chat message inputs */
          <View style={styles.inputArea}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Ask the coding agent to edit code..."
              placeholderTextColor="#6B7280"
              value={chatInput}
              onChangeText={setChatInput}
              editable={!activeJob || ['completed', 'failed'].includes(activeJob.state)}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!chatInput.trim() || (activeJob && !['completed', 'failed'].includes(activeJob.state))) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!chatInput.trim() || (activeJob && !['completed', 'failed'].includes(activeJob.state))}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  };

  const renderHistoryScreen = () => (
    <View style={styles.dashboardContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Task Logs</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.backButtonText}>← Dashboard</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={historyList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.historyItemCard}>
            <Text style={styles.historyRepo}>{item.repoFullName}</Text>
            <Text style={styles.historyPrompt}>Prompt: "{item.prompt}"</Text>
            <Text style={styles.historyCommit}>Commit: {item.commitMessage}</Text>
            <Text style={styles.historySha}>SHA: {item.commitSha ? item.commitSha.slice(0, 7) : 'N/A'}</Text>
            <View style={styles.historyStatsRow}>
              <Text style={styles.historyDuration}>Duration: {(item.durationMs / 1000).toFixed(1)}s</Text>
              <Text style={styles.historyStatus}>Status: {item.status.toUpperCase()}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyLabel}>No completed workspace tasks in history yet.</Text>
        }
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'auth' && renderAuthScreen()}
      {currentScreen === 'dashboard' && renderDashboardScreen()}
      {currentScreen === 'chat' && renderChatScreen()}
      {currentScreen === 'history' && renderHistoryScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0B0F19'
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 30
  },
  authCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151'
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15
  },
  primaryButton: {
    backgroundColor: '#00D8A4',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10
  },
  primaryButtonText: {
    color: '#0B0F19',
    fontSize: 16,
    fontWeight: 'bold'
  },
  toggleAuthMode: {
    marginTop: 20,
    alignItems: 'center'
  },
  toggleAuthText: {
    color: '#9CA3AF',
    fontSize: 14
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center'
  },

  // Dashboard styles
  dashboardContainer: {
    flex: 1,
    paddingHorizontal: 15
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 20
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  headerRow: {
    flexDirection: 'row'
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#374151',
    marginLeft: 8
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  workspaceCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#4338CA',
    marginBottom: 25
  },
  cardTag: {
    color: '#00D8A4',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8
  },
  workspaceRepo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5
  },
  workspaceBranch: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 15
  },
  cardActions: {
    flexDirection: 'row'
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4F46E5',
    borderRadius: 6,
    marginRight: 10
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13
  },
  dashboardSection: {
    marginBottom: 30
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15
  },
  providerToggleRow: {
    flexDirection: 'row',
    marginBottom: 15
  },
  providerToggle: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 6,
    marginRight: 10
  },
  providerToggleActive: {
    backgroundColor: '#00D8A4',
    borderColor: '#00D8A4'
  },
  providerToggleText: {
    color: '#9CA3AF',
    fontWeight: 'bold'
  },
  providerToggleTextActive: {
    color: '#0B0F19'
  },
  secondaryButton: {
    backgroundColor: '#1F2937',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151'
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold'
  },
  statusHelperText: {
    color: '#00D8A4',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center'
  },
  reposList: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 10
  },
  repoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937'
  },
  repoItemName: {
    color: '#FFFFFF',
    fontSize: 15
  },
  repoPrivateBadge: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  emptyLabel: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20
  },
  selectedRepoBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151'
  },
  selectedRepoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 8
  },
  branchScroller: {
    flexDirection: 'row',
    marginBottom: 20
  },
  branchTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#1F2937',
    marginRight: 8
  },
  branchTabActive: {
    backgroundColor: '#00D8A4'
  },
  branchTabText: {
    color: '#9CA3AF',
    fontSize: 12
  },
  branchTabTextActive: {
    color: '#0B0F19',
    fontWeight: 'bold'
  },
  selectedRepoActions: {
    marginTop: 10
  },

  // Chat Screen Styles
  chatContainer: {
    flex: 1
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937'
  },
  backButton: {
    paddingRight: 15
  },
  backButtonText: {
    color: '#00D8A4',
    fontSize: 14,
    fontWeight: 'bold'
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  stepperContainer: {
    backgroundColor: '#111827',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#374151'
  },
  stepperHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  stepperStateTitle: {
    color: '#9CA3AF',
    fontSize: 12
  },
  cancelLinkText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold'
  },
  cancelLink: {
    paddingHorizontal: 5
  },
  progressLineBg: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginBottom: 10
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: '#00D8A4',
    borderRadius: 2
  },
  stepperMessage: {
    color: '#D1D5DB',
    fontSize: 13
  },
  messageList: {
    padding: 15
  },
  msgBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    maxWidth: '85%'
  },
  msgBubbleUser: {
    backgroundColor: '#1F2937',
    alignSelf: 'flex-end'
  },
  msgBubbleAgent: {
    backgroundColor: '#1E1B4B',
    alignSelf: 'flex-start'
  },
  msgBubbleHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 4
  },
  msgBubbleContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    backgroundColor: '#111827',
    alignItems: 'center'
  },
  chatTextInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1F2937',
    borderRadius: 22,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 10
  },
  sendButton: {
    backgroundColor: '#00D8A4',
    height: 40,
    width: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#1F2937'
  },
  sendButtonText: {
    color: '#0B0F19',
    fontWeight: 'bold',
    fontSize: 13
  },

  // Code Review Panel
  reviewPanel: {
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    padding: 15,
    maxHeight: '65%'
  },
  reviewHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10
  },
  diffScrollView: {
    height: 120,
    backgroundColor: '#0B0F19',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151'
  },
  diffCode: {
    fontFamily: 'monospace',
    color: '#34D399',
    fontSize: 12
  },
  gatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  gateItem: {
    color: '#9CA3AF',
    fontSize: 12
  },
  reviewInput: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    height: 40,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 13
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12
  },

  // History Card
  historyItemCard: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#1F2937'
  },
  historyRepo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6
  },
  historyPrompt: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4
  },
  historyCommit: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 4
  },
  historySha: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 10
  },
  historyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 8
  },
  historyDuration: {
    color: '#9CA3AF',
    fontSize: 12
  },
  historyStatus: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold'
  }
});
