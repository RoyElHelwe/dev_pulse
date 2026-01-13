// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TaskRecord
 * @dev Records task completions on the blockchain for permanent, immutable proof
 * @notice This contract is used by Dev Pulse to verify task completions
 */
contract TaskRecord {
    struct TaskCompletion {
        bytes32 taskId;          // Hash of task ID
        bytes32 workspaceId;     // Hash of workspace ID
        address worker;          // Address who completed the task
        uint256 timestamp;       // Block timestamp when recorded
        bytes32 proofHash;       // Hash of task details for verification
        string ipfsMetadata;     // Optional IPFS link to full details
    }
    
    // Task ID => TaskCompletion
    mapping(bytes32 => TaskCompletion) public completions;
    
    // Worker address => array of task IDs they completed
    mapping(address => bytes32[]) public workerTasks;
    
    // Workspace => array of task IDs
    mapping(bytes32 => bytes32[]) public workspaceTasks;
    
    // Total number of recorded tasks
    uint256 public totalRecorded;
    
    // Contract owner (for potential upgrades/admin)
    address public owner;
    
    // Authorized recorders (backend services)
    mapping(address => bool) public authorizedRecorders;
    
    // Events
    event TaskCompleted(
        bytes32 indexed taskId,
        bytes32 indexed workspaceId,
        address indexed worker,
        uint256 timestamp,
        bytes32 proofHash
    );
    
    event RecorderAuthorized(address indexed recorder);
    event RecorderRevoked(address indexed recorder);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedRecorders[msg.sender],
            "Not authorized to record"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedRecorders[msg.sender] = true;
    }
    
    /**
     * @dev Record a task completion on the blockchain
     * @param _taskId Hash of the task ID
     * @param _workspaceId Hash of the workspace ID
     * @param _worker Address of the worker who completed the task
     * @param _proofHash Hash of task details for verification
     * @param _ipfsMetadata Optional IPFS link to full metadata
     */
    function recordTaskCompletion(
        bytes32 _taskId,
        bytes32 _workspaceId,
        address _worker,
        bytes32 _proofHash,
        string memory _ipfsMetadata
    ) external onlyAuthorized {
        require(completions[_taskId].timestamp == 0, "Task already recorded");
        require(_worker != address(0), "Invalid worker address");
        
        TaskCompletion memory completion = TaskCompletion({
            taskId: _taskId,
            workspaceId: _workspaceId,
            worker: _worker,
            timestamp: block.timestamp,
            proofHash: _proofHash,
            ipfsMetadata: _ipfsMetadata
        });
        
        completions[_taskId] = completion;
        workerTasks[_worker].push(_taskId);
        workspaceTasks[_workspaceId].push(_taskId);
        totalRecorded++;
        
        emit TaskCompleted(_taskId, _workspaceId, _worker, block.timestamp, _proofHash);
    }
    
    /**
     * @dev Get all task IDs completed by a worker
     * @param _worker Address of the worker
     * @return Array of task ID hashes
     */
    function getWorkerCompletions(address _worker) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return workerTasks[_worker];
    }
    
    /**
     * @dev Get all task IDs for a workspace
     * @param _workspaceId Hash of the workspace ID
     * @return Array of task ID hashes
     */
    function getWorkspaceTasks(bytes32 _workspaceId)
        external
        view
        returns (bytes32[] memory)
    {
        return workspaceTasks[_workspaceId];
    }
    
    /**
     * @dev Verify if a task was completed by a specific worker
     * @param _taskId Hash of the task ID
     * @param _worker Address of the worker to verify
     * @return isVerified Whether the worker completed the task
     * @return timestamp When the task was recorded (0 if not found)
     */
    function verifyCompletion(bytes32 _taskId, address _worker) 
        external 
        view 
        returns (bool isVerified, uint256 timestamp) 
    {
        TaskCompletion memory completion = completions[_taskId];
        isVerified = completion.worker == _worker && completion.timestamp > 0;
        timestamp = completion.timestamp;
    }
    
    /**
     * @dev Get full completion details for a task
     * @param _taskId Hash of the task ID
     * @return The TaskCompletion struct
     */
    function getCompletion(bytes32 _taskId)
        external
        view
        returns (TaskCompletion memory)
    {
        return completions[_taskId];
    }
    
    /**
     * @dev Get the count of tasks completed by a worker
     * @param _worker Address of the worker
     * @return Number of tasks completed
     */
    function getWorkerTaskCount(address _worker)
        external
        view
        returns (uint256)
    {
        return workerTasks[_worker].length;
    }
    
    // Admin functions
    
    /**
     * @dev Authorize a new address to record tasks
     * @param _recorder Address to authorize
     */
    function authorizeRecorder(address _recorder) external onlyOwner {
        authorizedRecorders[_recorder] = true;
        emit RecorderAuthorized(_recorder);
    }
    
    /**
     * @dev Revoke recording authorization
     * @param _recorder Address to revoke
     */
    function revokeRecorder(address _recorder) external onlyOwner {
        authorizedRecorders[_recorder] = false;
        emit RecorderRevoked(_recorder);
    }
    
    /**
     * @dev Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner");
        owner = _newOwner;
    }
}
