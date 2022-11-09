import {
    AmbientLight,
    AxesHelper,
    DirectionalLight,
    GridHelper,
    MeshBasicMaterial,
    MeshLambertMaterial,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Vector2,
    WebGLRenderer,
  } from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { IFCLoader } from "web-ifc-three";
  import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
  import { IFCBUILDING } from "web-ifc";
  
  //Creates the Three.js scene
  const scene = new Scene();
  
  //Object to store the size of the viewport
  const size = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  
  //Creates the camera (point of view of the user)
  const camera = new PerspectiveCamera(75, size.width / size.height);
  camera.position.z = 15;
  camera.position.y = 13;
  camera.position.x = 8;
  
  
  //Creates the lights of the scene
  const lightColor = 0xffffff;
  
  const ambientLight = new AmbientLight(lightColor, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new DirectionalLight(lightColor, 2);
  directionalLight.position.set(0, 10, 0);
  scene.add(directionalLight);
  
  //Sets up the renderer, fetching the canvas of the HTML
  const canvas = document.getElementById("three-canvas");
  const renderer = new WebGLRenderer({ canvas: canvas, alpha: true });
  renderer.setSize(size.width, size.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  //Creates grids and axes in the scene
  const grid = new GridHelper(50, 30);
  scene.add(grid);
  
  const axes = new AxesHelper();
  axes.material.depthTest = false;
  axes.renderOrder = 1;
  scene.add(axes);
  
  //Creates the orbit controls (to navigate the scene)
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;  
  controls.target.set(-2, 0, 0);
  
  //Animation loop  
  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  
  animate();
  
  //Adjust the viewport to the size of the browser
  window.addEventListener("resize", () => {
    (size.width = window.innerWidth), (size.height = window.innerHeight);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
  });

  const loader = new IFCLoader();

  loader.ifcManager.setWasmPath('wasm/');

  

  loader.ifcManager.setupThreeMeshBVH(computeBoundsTree, disposeBoundsTree, acceleratedRaycast);

  const ifcModels = [];

  let model;

  const input = document.getElementById("file-input");
  input.addEventListener('change', async () => {
    const file = input.files[0];
    const url = URL.createObjectURL(file);
    model = await loader.loadAsync(url);
    scene.add(model);
    ifcModels.push(model);

    const ifcProject = await loader.ifcManager.getSpatialStructure(model.modelID);
    createTreeMenu(ifcProject);
  });

  const toggler = document.getElementsByClassName("caret");
  for (let i = 0; i < toggler.length; i++) {
    toggler[i].onclick = () => {
      toggler[i].parentElement.querySelector(".nested").classList.toggle("active");
      toggler[i].classList.toggle("caret-down");
    }
  }

  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const mouse = new Vector2();

  function cast(event) {
    const bounds = canvas.getBoundingClientRect();
    const x1 = event.clientX - bounds.left;
    const x2 = bounds.right - bounds.left;
    mouse.x = (x1 / x2) * 2 - 1;

    const y1 = event.clientY - bounds.top;
    const y2 = bounds.bottom - bounds.top;
    mouse.y = -(y1 / y2) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    return raycaster.intersectObjects(ifcModels);
  }


  function createTreeMenu(ifcProject) {
    const root = document.getElementById("tree-root");
    removeAllChildren(root);
    const ifcProjectNode = createNestedChild(root, ifcProject);
    ifcProject.children.forEach(child => {
        constructTreeMenuNode(ifcProjectNode, child);
    });
  }

  function nodeToString(node) {
    return `${node.type} - ${node.expressID}`;
  }

  function constructTreeMenuNode(parent, node) {
    const children = node.children;
    if (children.length === 0) {
        createSimpleChild(parent, node);
        return;
    }
    const nodeElement = createNestedChild(parent, node);
    children.forEach(child => {
        constructTreeMenuNode(nodeElement, child);
    })
  }

  function createNestedChild(parent, node) {
      const content = nodeToString(node);
      const root = document.createElement('li');
      createTitle(root, content);
      const childrenContainer = document.createElement('ul');
      childrenContainer.classList.add("nested");
      root.appendChild(childrenContainer);
      parent.appendChild(root);
      return childrenContainer;
  }

  function createTitle(parent, content) {
      const title = document.createElement("span");
      title.classList.add("caret");
      title.onclick = () => {
          title.parentElement.querySelector(".nested").classList.toggle("active");
          title.classList.toggle("caret-down");
      }
      title.textContent = content;
      parent.appendChild(title);
  }

  function createSimpleChild(parent, node) {
      const content = nodeToString(node);
      const childNode = document.createElement('li');
      childNode.classList.add('leaf-node');
      childNode.textContent = content;
      parent.appendChild(childNode);

      let lastMaterial;

      childNode.onmousemove = async () => {
        const id = node.expressID;
        loader.ifcManager.createSubset({
          modelID: 0,
          material: highlightMaterial,
          ids: [id],
          scene,
          removePrevious: true
        });
      };

      childNode.onclick = async () => {
        const id = node.expressID;
        const buildingsIDS = await loader.ifcManager.getAllItemsOfType(0, IFCBUILDING);
        const buildingID = buildingsIDS[0];

        const buildingProps = await loader.ifcManager.getItemProperties(0, buildingID);
        //console.log(buildingProps);

        

        loader.ifcManager.createSubset({
          modelID: 0,
          material: selectionMaterial,
          ids: [id],
          scene,
          removePrevious: true
        });
      }

      // childNode.ondblclick = () => {
      //   const id = node.expressID;
      //   loader.ifcManager.createSubset({
      //     modelID: 0,
      //     material: lastMaterial,
      //     ids: [id],
      //     scene
      //   });
      //   //console.log(material);
      //   // loader.ifcManager.removeFromSubset(0, selectionMaterial);
      //   // loader.ifcManager.removeFromSubset(0, highlightMaterial);
      //   console.log("dbclick");
      // }
  }

  function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
  }

  const highlightMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.6,
    color: 0xff88ff,
    depthTest: false
  });

  const selectionMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    color: 0xff22ff,
    depthTest: false
  });

  let lastModal;

  async function pick(event, material, getProps) {
    const found = cast(event)[0];
    if (found) {
        const index = found.faceIndex;  
        lastModal = found.object;     
        const geometry = found.object.geometry;
        const id = loader.ifcManager.getExpressId(geometry, index);

        if(getProps){
          const buildingsIDS = await loader.ifcManager.getAllItemsOfType(found.object.modelID, IFCBUILDING);
          const buildingID = buildingsIDS[0];

          const buildingProps = await loader.ifcManager.getItemProperties(found.object.modelID, buildingID);
          console.log(buildingProps);

          // const props = await loader.ifcManager.getItemProperties(found.object.modelID, id);
          // console.log(props);
          // const psets = await loader.ifcManager.getPropertySets(found.object.modelID, id);
          
          // for(const pset of psets){
          //   const realValues = [];

          //   for(const prop of pset.HasProperties){
          //     const id = prop.value;
          //     const value = await loader.ifcManager.getItemProperties(found.object.modelID, id);
          //     realValues.push(value);
          //   }

          //   pset.HasProperties = realValues;
          // }          

          // console.log(psets);
        }

        loader.ifcManager.createSubset({
          modelID: found.object.modelID,
          material: material,
          ids: [id],
          scene,
          removePrevious: true
        });
    } else if(lastModal){
      loader.ifcManager.removeFromSubset(lastModal.modelID, material);
      lastModal = undefined;
    }
  }

  // canvas.onclick = (event) => pick(event, highlightMaterial, false);
  // canvas.ondblclick = (event) => pick(event, selectionMaterial, true);
