// Entry point for the notebook bundle containing custom model definitions.

// debugger;
define(['base/js/namespace'], function(Jupyter) {
  'use strict';

  window['requirejs'].config({
    map: {
      '*': {
        jupyter_ascending: 'nbextensions/jupyter_ascending/index',
      },
    },
  });

  const IS_DEBUG = false;
  const TARGET_NAME = 'AUTO_SYNC::notebook';

  function get_notebook_name() {
    // return window.document.getElementById("notebook_name").innerHTML;
    return Jupyter.notebook.notebook_path;
  }

  function is_synced_notebook() {
    return get_notebook_name().includes('.synced.ipynb');
  }

  function get_cell_from_notebook(cell_number) {
    let cell = Jupyter.notebook.get_cell(cell_number);

    while (cell === null) {
      // Kind of meh hack to just keep spamming cells at bottom until we get to the cell we want.
      Jupyter.notebook.insert_cell_at_bottom();

      cell = Jupyter.notebook.get_cell(cell_number);
    }

    return cell;
  }

  function update_cell_contents(data) {
    let cell = get_cell_from_notebook(data.cell_number);

    cell.set_text(data.cell_contents);
  }

  function execute_cell_contents(data) {
    let cell = get_cell_from_notebook(data.cell_number);

    cell.focus_cell();
    cell.execute();

    // TODO: ??
    cell.focus_cell();
  }

  function op_code__delete_cells(data) {
    console.log('Deleting cell...', data);

    Jupyter.notebook.delete_cells(data.cell_indices);
  }

  function op_code__insert_cell(data) {
    console.log('Inserting cell...', data);

    let new_cell = Jupyter.notebook.insert_cell_at_index(
      data.cell_type,
      data.cell_number
    );
    new_cell.set_text(data.cell_contents);
  }

  function op_code__replace_cell(data) {
    console.log('Replacing cell...', data);

    update_cell_contents(data);
  }

  // function focus_cell(data) {
  //   let cell = get_cell_from_notebook(data.cell_number);

  //   cell.focus_cell();
  //   // TODO: Focus the output so you can see all of it if it's long
  // }

  function get_status(comm_obj) {
    comm_obj.send({
      command: 'update_status',
      status: Jupyter.notebook.get_cells(),
    });
  }

  function start_sync_notebook(comm_obj, msg) {
    comm_obj.send({
      command: 'merge_notebooks',
      javascript_cells: Jupyter.notebook.get_cells(),
      new_notebook: msg.content.data.cells,
    });
  }

  function create_and_register_comm() {
    // Make sure that the extension is loaded.
    //  TODO: Perhaps it's possible to not do  this if it's already loaded,
    //  but it's fine to be run multiple times.
    //
    //  As a note, I think some people would probably disapprove of this?
    //  It just runs code... but that's what plugins do?
    Jupyter.notebook.kernel.execute('%load_ext jupyter_ascending');

    Jupyter.notebook.kernel.comm_manager.register_target(
      TARGET_NAME,
      // comm is the frontend comm instance
      // msg is the comm_open message, which can carry data
      function(comm, _msg) {
        // Register handlers for later messages:
        comm.on_msg(function(msg) {
          if (IS_DEBUG) {
            console.log('Processing a message');
            console.log(msg);
          }

          const data = msg.content.data;
          const command = data.command;

          if (command === 'start_sync_notebook') {
            console.log('Starting Sync');
            return start_sync_notebook(comm, msg);
          }

          if (command === 'op_code__delete_cells') {
            return op_code__delete_cells(data);
          }

          if (command === 'op_code__insert_cell') {
            return op_code__insert_cell(data);
          }

          if (command === 'op_code__replace_cell') {
            return op_code__replace_cell(data);
          }

          if (command === 'get_status') {
            console.log('Sending get_status');
            return get_status(comm);
          }

          if (msg.content.data.command === 'update') {
            update_cell_contents(msg.content.data);
          } else if (msg.content.data.command === 'execute') {
            execute_cell_contents(msg.content.data);
          } else if (msg.content.data.command === 'status') {
            console.log('give em the status');
          } else {
            // debugger;
            console.log('Got an unexpected message: ', msg);
          }
        });

        comm.on_close(function(msg) {
          console.log('close', msg);
        });
      }
    );
  }

  // Export the required load_ipython_extension function
  return {
    load_ipython_extension: function() {
      Jupyter.notebook.config.loaded
        .then(
          function on_config_loaded() {
            console.log('Loaded config...');
          },
          function on_config_error() {
            console.log('ERROR OF LOADING...???');
          }
        )
        .then(function actually_load() {
          console.log('===================================');
          // console.log(ascend);
          console.log('Loading Jupyter Ascending extension...');
          console.log('Opening... ', get_notebook_name());
          console.log('Is synced: ', is_synced_notebook());

          console.log('Attemping create comm...');
          if (Jupyter.notebook.kernel) {
            create_and_register_comm();
          } else {
            Jupyter.notebook.events.one('kernel_ready.Kernel', () => {
              create_and_register_comm();
            });
          }
          console.log('... success!');

          console.log('===================================');
        });
    },
  };
});
